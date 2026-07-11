<?php

namespace App\Http\Controllers\Driver;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DriverAuthController extends Controller
{
    public function showLogin(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return Auth::user()->hasAnyRole(['driver', 'admin'])
                ? redirect()->route('driver.index')
                : redirect()->route('home');
        }

        return Inertia::render('Driver/Login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if (! Auth::user()->hasAnyRole(['driver', 'admin'])) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => ['This account is not a driver account. Please use the staff login.'],
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('driver.index'));
    }
}
