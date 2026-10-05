<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureSystemRateLimits();
        $this->overrideConfigFromSettings();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function overrideConfigFromSettings(): void
    {
        try {
            $settings = DB::table('settings')
                ->whereIn('key', [
                    'mail_host', 'mail_port', 'mail_username', 'mail_password',
                    'mail_encryption', 'mail_from_address', 'mail_from_name',
                    'pusher_app_id', 'pusher_app_key', 'pusher_app_secret', 'pusher_app_cluster',
                ])
                ->pluck('value', 'key')
                ->filter(fn (?string $value): bool => $value !== null && $value !== '');

            if ($settings->isEmpty()) {
                return;
            }

            config([
                'mail.mailers.smtp.host' => $settings->get('mail_host', config('mail.mailers.smtp.host')),
                'mail.mailers.smtp.port' => $settings->get('mail_port', config('mail.mailers.smtp.port')),
                'mail.mailers.smtp.username' => $settings->get('mail_username', config('mail.mailers.smtp.username')),
                'mail.mailers.smtp.password' => $settings->get('mail_password', config('mail.mailers.smtp.password')),
                'mail.mailers.smtp.encryption' => $settings->get('mail_encryption', config('mail.mailers.smtp.encryption')),
                'mail.from.address' => $settings->get('mail_from_address', config('mail.from.address')),
                'mail.from.name' => $settings->get('mail_from_name', config('mail.from.name')),

                'broadcasting.connections.pusher.app_id' => $settings->get('pusher_app_id', config('broadcasting.connections.pusher.app_id')),
                'broadcasting.connections.pusher.key' => $settings->get('pusher_app_key', config('broadcasting.connections.pusher.key')),
                'broadcasting.connections.pusher.secret' => $settings->get('pusher_app_secret', config('broadcasting.connections.pusher.secret')),
                'broadcasting.connections.pusher.options.cluster' => $settings->get('pusher_app_cluster', config('broadcasting.connections.pusher.options.cluster')),
            ]);
        } catch (\Throwable) {
            // DB not ready yet (e.g. during fresh migrations) — skip silently
        }
    }

    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }

    /**
     * Backups and the destructive database actions are slow and heavy, so they are limited per user.
     */
    protected function configureSystemRateLimits(): void
    {
        // The attendance screen is public, so guessing employee IDs from one address is slowed right down.
        RateLimiter::for('attendance-punch', fn (Request $request) => Limit::perMinute(20)->by($request->ip().'|attendance'));

        foreach (['backup-create' => 6, 'backup-import' => 6, 'db-restore' => 3, 'db-reset' => 3] as $name => $perMinute) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($perMinute)->by(($request->user()?->id ?? $request->ip()).'|'.$name));
        }
    }
}
