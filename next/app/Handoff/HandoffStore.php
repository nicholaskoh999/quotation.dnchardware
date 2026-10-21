<?php

namespace App\Handoff;

use App\Handoff\Contract\HandoffToken;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Cache\Factory as CacheFactory;
use Illuminate\Contracts\Cache\Repository;
use Throwable;

/**
 * Replay protection and rate limiting for the handoff endpoints, kept in the
 * Laravel cache (file store by default) instead of the legacy branch's two
 * database tables — Wave 1 adds no migration and no schema change.
 *
 *  - Rate limit (contract §6.1 / §6.3): 30 requests per minute per IP, per
 *    endpoint. The IP is part of a SHA-256 key only.
 *  - Replay (contract §7): a jti is consumed with an atomic cache add(); the
 *    first consumer wins, every later one is 'replayed'. Kept an hour past
 *    the token's exp.
 *
 * Every failure to count or record is reported as such (null /
 * 'replay_store_failed') and the caller fails CLOSED.
 */
final class HandoffStore
{
    public function __construct(private readonly CacheFactory $cache) {}

    /** @return bool|null true = over the limit; null = could not be counted */
    public function rateLimited(string $endpoint, string $ip, int $now): ?bool
    {
        try {
            $window = (int) config('quotation.handoff.rate_window_seconds', 60);
            $limit = (int) config('quotation.handoff.rate_limit', 30);
            $bucket = 'handoff:rl:'.hash('sha256', $endpoint.'|'.$ip).':'.intdiv($now, $window);
            $hits = (new RateLimiter($this->store()))->hit($bucket, $window * 2);

            return $hits > $limit;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * @param  array{jti: string, sub: string, exp: int}  $claims  verified claims
     * @return string|null null when consumed now; 'replayed'; 'replay_store_failed'
     */
    public function consumeJti(array $claims, int $now): ?string
    {
        try {
            $keep = (int) config('quotation.handoff.replay_keep_seconds', 3600);
            $ttl = max(HandoffToken::MAX_TTL_SECONDS, $claims['exp'] + $keep - $now);
            $added = $this->store()->add('handoff:jti:'.$claims['jti'], $claims['sub'], $ttl);

            return $added ? null : 'replayed';
        } catch (Throwable) {
            return 'replay_store_failed';
        }
    }

    private function store(): Repository
    {
        return $this->cache->store(config('quotation.handoff.cache_store', 'file'));
    }
}
