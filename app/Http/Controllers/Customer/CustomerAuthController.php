<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAuthController extends Controller
{
    public function showLogin(Request $request, ?string $qrToken = null): Response
    {
        return Inertia::render('Customer/Auth/Login', [
            'qrToken' => $qrToken ?? $request->query('qrToken'),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'qrToken' => ['nullable', 'string'],
        ]);

        if (! Auth::guard('customer')->attempt(
            ['email' => $validated['email'], 'password' => $validated['password']],
            $request->boolean('remember')
        )) {
            return back()
                ->withErrors(['email' => 'Invalid email or password.'])
                ->withInput($request->only('email', 'qrToken'));
        }

        $request->session()->regenerate();

        /** @var Customer $customer */
        $customer = Auth::guard('customer')->user();

        if (! $customer->hasVerifiedEmail()) {
            if (! empty($validated['qrToken'])) {
                session()->put('customer.qr_token', $validated['qrToken']);
            }

            return redirect()->route('customer.auth.email.notice');
        }

        $intended = session()->pull('customer.intended_url');

        if ($intended) {
            return redirect()->to($intended);
        }

        if (! empty($validated['qrToken'])) {
            return redirect()->route('storefront.show', ['qrToken' => $validated['qrToken']]);
        }

        return redirect('/');
    }

    public function showRegister(Request $request, ?string $qrToken = null): Response
    {
        return Inertia::render('Customer/Auth/Register', [
            'qrToken' => $qrToken ?? $request->query('qrToken'),
        ]);
    }

    public function register(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'qrToken' => ['nullable', 'string'],
        ]);

        $customer = Customer::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
        ]);

        // Store qrToken so we can redirect after verification
        if (! empty($validated['qrToken'])) {
            session()->put('customer.qr_token', $validated['qrToken']);
        }

        // Send verification email before logging in
        $customer->sendEmailVerificationNotification();

        // Log in but force the verify-email gate
        Auth::guard('customer')->login($customer);
        $request->session()->regenerate();

        return redirect()->route('customer.auth.email.notice');
    }

    // ── Email verification ────────────────────────────────────────────────────

    public function showVerifyEmail(): Response
    {
        return Inertia::render('Customer/Auth/VerifyEmail');
    }

    public function verifyEmail(Request $request, int $id, string $hash): RedirectResponse
    {
        if (! $request->hasValidSignature()) {
            return redirect()->route('customer.auth.email.notice')
                ->withErrors(['verification' => 'This verification link has expired or is invalid.']);
        }

        $customer = Customer::findOrFail($id);

        if (! hash_equals($hash, sha1($customer->getEmailForVerification()))) {
            return redirect()->route('customer.auth.email.notice')
                ->withErrors(['verification' => 'Invalid verification link.']);
        }

        if (! $customer->hasVerifiedEmail()) {
            $customer->markEmailAsVerified();
        }

        // Ensure the customer is logged in after verifying via email link
        Auth::guard('customer')->login($customer);

        $intended = session()->pull('customer.intended_url');
        $qrToken = session()->pull('customer.qr_token');

        if ($intended) {
            return redirect()->to($intended)->with('success', 'Email verified! Welcome to Milk&Honey.');
        }

        if ($qrToken) {
            return redirect()->route('storefront.show', ['qrToken' => $qrToken])
                ->with('success', 'Email verified! Welcome to Milk&Honey.');
        }

        return redirect('/')->with('success', 'Email verified!');
    }

    public function resendVerification(Request $request): RedirectResponse
    {
        /** @var Customer $customer */
        $customer = Auth::guard('customer')->user();

        if ($customer->hasVerifiedEmail()) {
            return redirect()->route('customer.auth.email.notice');
        }

        $customer->sendEmailVerificationNotification();

        return back()->with('success', 'Verification email resent! Check your inbox.');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('customer')->logout();

        return redirect('/');
    }
}
