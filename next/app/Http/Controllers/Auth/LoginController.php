<?php

namespace App\Http\Controllers\Auth;

use App\Auth\SafeNext;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * GET/POST /login, POST /logout — legacy login.php / logout.php behaviour on
 * Laravel's session + CSRF (both POSTs are CSRF-protected by the web group).
 */
final class LoginController extends Controller
{
    /** The two legacy messages (login.php errLoginMissing / errLoginBad). */
    public const MSG_MISSING = 'Please enter both username and password.';

    public const MSG_BAD = 'Wrong username or password.';

    public const MSG_SIGNED_OUT = 'You have been signed out on this device.';

    public function show(Request $request): Response
    {
        // Legacy ?next= — same-origin paths only.
        if ($request->query->has('next')) {
            $next = SafeNext::path($request->query('next'));
            if ($next !== SafeNext::DEFAULT) {
                $request->session()->put('url.intended', $next);
            }
        }

        return Inertia::render('Auth/Login');
    }

    public function store(Request $request): RedirectResponse
    {
        $username = $request->input('username');
        $password = $request->input('password');
        $username = is_string($username) ? trim($username) : '';
        $password = is_string($password) ? $password : '';

        if ($username === '' || $password === '') {
            throw ValidationException::withMessages(['username' => self::MSG_MISSING]);
        }

        // Remember-me does not exist: the second argument is always false.
        if (! Auth::guard()->attempt(['username' => $username, 'password' => $password], false)) {
            throw ValidationException::withMessages(['username' => self::MSG_BAD]);
        }

        // The guard already gave the session a new id; rotate CSRF too.
        $request->session()->regenerateToken();

        $target = SafeNext::fromIntended($request->session()->pull('url.intended'), $request->getHost());

        return redirect()->to($target, 303);
    }

    /** Signs out THIS browser only; other staff/devices keep their sessions. */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->to('/login', 303)->with('success', self::MSG_SIGNED_OUT);
    }
}
