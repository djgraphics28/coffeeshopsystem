<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Settings', [
            'settings' => Setting::getAll(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'cafe_name' => ['required', 'string', 'max:100'],
            'cafe_tagline' => ['nullable', 'string', 'max:200'],
            'tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'currency' => ['required', 'string', 'max:5'],
            'opening_time' => ['nullable', 'string'],
            'closing_time' => ['nullable', 'string'],
            'estimated_wait_minutes' => ['nullable', 'string', 'max:20'],
            'pay_as_you_order' => ['nullable', 'boolean'],
            'points_earn_rate' => ['nullable', 'numeric', 'min:0'],
            'points_redeem_rate' => ['nullable', 'integer', 'min:1'],
            'loyalty_cups_enabled' => ['nullable', 'boolean'],
            'loyalty_cups_threshold' => ['nullable', 'integer', 'min:1', 'max:100'],
            // Mail SMTP
            'mail_host' => ['nullable', 'string', 'max:255'],
            'mail_port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'mail_username' => ['nullable', 'string', 'max:255'],
            'mail_password' => ['nullable', 'string', 'max:255'],
            'mail_encryption' => ['nullable', 'string', 'in:tls,ssl,none'],
            'mail_from_address' => ['nullable', 'email', 'max:255'],
            'mail_from_name' => ['nullable', 'string', 'max:255'],
            // Pusher
            'pusher_app_id' => ['nullable', 'string', 'max:100'],
            'pusher_app_key' => ['nullable', 'string', 'max:100'],
            'pusher_app_secret' => ['nullable', 'string', 'max:100'],
            'pusher_app_cluster' => ['nullable', 'string', 'max:20'],
        ]);

        $validated['pay_as_you_order'] = $request->boolean('pay_as_you_order') ? '1' : '0';
        $validated['loyalty_cups_enabled'] = $request->boolean('loyalty_cups_enabled') ? '1' : '0';
        $validated['points_earn_rate'] ??= '1';
        $validated['points_redeem_rate'] ??= '100';
        $validated['loyalty_cups_threshold'] ??= '10';
        $validated['mail_port'] ??= '587';
        $validated['mail_encryption'] ??= 'tls';
        $validated['pusher_app_cluster'] ??= 'ap1';

        foreach ($validated as $key => $value) {
            Setting::set($key, $value);
        }

        return redirect()->back()->with('success', 'Settings saved.');
    }
}
