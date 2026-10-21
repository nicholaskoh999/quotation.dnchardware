<?php

namespace App\Http\Controllers\Auth;

use App\Auth\AppUser;
use App\Handoff\Contract\HandoffToken;
use App\Handoff\Contract\InvalidHandoffToken;
use App\Handoff\DncUserDirectory;
use App\Handoff\HandoffLog;
use App\Handoff\HandoffStore;
use App\Http\Controllers\Controller;
use App\Services\Identity\Actor;
use App\Services\Identity\ActorSource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * DNC Workspace → Quotation sign-in, contract v2, TARGET side (audience
 * "quotation"). A Laravel port of legacy dnc_handoff.php on
 * origin/round/r5-c-portal-handoff — same contract code (byte for byte),
 * same claims, same audience semantics, same processing order (§6.4):
 *
 *   GET /auth/handoff/start     → 303 Portal /handoff/authorize?audience=quotation&state=…
 *   GET /auth/handoff/callback  → verify, consume state + jti, re-read the
 *                                 canonical user, new Quotation session → 303 /
 *
 * SHIPS OFF: both answer 404 unless DNC_HANDOFF_ENABLED=true. Differences
 * from the legacy branch are mechanics only (app/Auth/NOTES.md): replay and
 * rate limit live in the Laravel cache, not in new tables.
 *
 * NEVER logged or rendered: the token, the state, a secret, a password or a
 * session id. The browser only ever sees one generic failure message.
 */
final class HandoffController extends Controller
{
    public const STATES_KEY = 'dnc_handoff_states';

    public const MSG_FAILED = 'That sign-in link is invalid or has expired. Please sign in.';

    private const PORTAL_ORIGIN_PATTERN = '#^https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$#';

    public function __construct(
        private readonly HandoffStore $store,
        private readonly DncUserDirectory $users,
        private readonly HandoffLog $log,
    ) {}

    /** Reads no query parameter: redirect_uri, next, url, callback… are ignored. */
    public function start(Request $request): Response
    {
        abort_unless($this->enabled(), 404);

        try {
            $now = time();
            $limited = $this->store->rateLimited('start', $this->ip($request), $now);
            if ($limited === true) {
                $this->log->write('auth.handoff_throttled', ['endpoint' => 'start', 'ip' => $this->ip($request)]);

                return $this->respond(429);
            }
            if ($limited === null) {
                return $this->fail($request, 'throttle_unavailable');
            }

            $portal = $this->portalOrigin();
            if ($portal === null) {
                return $this->fail($request, 'bad_portal_url');
            }

            [$state, $pending] = HandoffToken::startState($this->pending($request), $now);
            $request->session()->put(self::STATES_KEY, $pending);

            return $this->respond(303, HandoffToken::authorizeUrl($portal, HandoffToken::AUDIENCE_QUOTATION, $state));
        } catch (Throwable) {
            return $this->fail($request, 'internal_error');
        }
    }

    public function callback(Request $request): Response
    {
        // 0
        abort_unless($this->enabled(), 404);

        try {
            return $this->handleCallback($request, time());
        } catch (Throwable) {
            return $this->fail($request, 'internal_error');
        }
    }

    private function handleCallback(Request $request, int $now): Response
    {
        $limited = $this->store->rateLimited('callback', $this->ip($request), $now);
        if ($limited === true) {
            $this->log->write('auth.handoff_throttled', ['endpoint' => 'callback', 'ip' => $this->ip($request)]);

            return $this->respond(429);
        }

        // 3 (read before anything can change it)
        $pending = $this->pending($request);
        try {
            // 1
            $token = $request->query('token');
            if (! is_string($token)) {
                throw new InvalidHandoffToken(InvalidHandoffToken::MALFORMED);
            }
            // 2
            try {
                $keys = $this->keys();
            } catch (InvalidHandoffToken $e) {
                $this->log->write('auth.handoff_misconfigured', ['reason' => 'bad_secret']);
                throw $e;
            }
            // 4 — format, signature, iss, aud, claims, lifetime, time, then state
            $claims = HandoffToken::verify($token, HandoffToken::AUDIENCE_QUOTATION, $keys, $now, $pending);
        } catch (InvalidHandoffToken $e) {
            return $this->fail($request, $e->reason); // steps 1–4: nothing written
        }
        if ($limited === null) {
            return $this->fail($request, 'throttle_unavailable', $claims);
        }

        // 5 — from here a failure leaves the state and the jti used up
        $remaining = HandoffToken::consumeState($pending, $claims['state_hash'], $now);
        $request->session()->put(self::STATES_KEY, $remaining);

        // 6
        $replay = $this->store->consumeJti($claims, $now);
        if ($replay !== null) {
            return $this->fail($request, $replay, $claims);
        }

        // 7 — fresh read of the canonical row, by users.id only (fail closed)
        $row = $this->users->find((int) $claims['sub']);
        if ($row === false) {
            return $this->fail($request, 'user_source_unavailable', $claims);
        }
        $reason = DncUserDirectory::refusal($row, $claims);
        if ($reason !== null) {
            return $this->fail($request, $reason, $claims);
        }
        /** @var array{id: int, username: string, name: string, role: string} $row */

        // 8 — Quotation's own session: drop the old one, new id, DNC identity
        $session = $request->session();
        $session->invalidate();
        Auth::guard()->login(new AppUser(new Actor(
            id: null,
            username: $row['username'],
            displayName: DncUserDirectory::displayName($row),
            source: ActorSource::Dnc,
            dncUserId: $row['id'],
            dncRole: $row['role'],
        )));
        $session->regenerateToken();
        $session->put(self::STATES_KEY, $remaining); // other tabs' pending handoffs survive

        // 9
        $this->log->write('auth.handoff_succeeded', ['jti' => $claims['jti'], 'sub' => $claims['sub'], 'ip' => $this->ip($request)]);

        // 10
        return $this->respond(303, '/');
    }

    private function enabled(): bool
    {
        return config('quotation.handoff.enabled') === true;
    }

    /** The ONLY place /start may send a browser: a plain https origin, or null. */
    private function portalOrigin(): ?string
    {
        $url = rtrim((string) config('quotation.handoff.portal_url', ''), '/');

        return preg_match(self::PORTAL_ORIGIN_PATTERN, $url) === 1 ? $url : null;
    }

    /**
     * Current key, then the previous one during a rotation (contract §4.3).
     *
     * @return list<string>
     *
     * @throws InvalidHandoffToken bad_secret, without echoing a value
     */
    private function keys(): array
    {
        $keys = [HandoffToken::parseSecret(config('quotation.handoff.secret'))];
        $previous = config('quotation.handoff.secret_previous');
        if (is_string($previous) && trim($previous) !== '') {
            $keys[] = HandoffToken::parseSecret($previous);
        }

        return $keys;
    }

    /** @return array<mixed> */
    private function pending(Request $request): array
    {
        $p = $request->session()->get(self::STATES_KEY, []);

        return is_array($p) ? $p : [];
    }

    private function ip(Request $request): string
    {
        $ip = (string) $request->ip();

        return filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
    }

    /** @param  array<string, mixed>|null  $claims */
    private function fail(Request $request, string $reason, ?array $claims = null): Response
    {
        $fields = ['reason' => $reason, 'ip' => $this->ip($request)];
        if ($claims !== null) {
            $fields['jti'] = $claims['jti'];
            $fields['sub'] = $claims['sub'];
        }
        $this->log->write('auth.handoff_failed', $fields);
        $request->session()->flash('error', self::MSG_FAILED);

        return $this->respond(303, '/login');
    }

    /** Every handoff answer: 303 (or 429), empty body, no-referrer, no-store. */
    private function respond(int $status, ?string $location = null): Response
    {
        $response = response('', $status);
        if ($location !== null) {
            $response->headers->set('Location', $location);
        }
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
