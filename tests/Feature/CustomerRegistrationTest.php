<?php

use App\Models\Customer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

use function Pest\Laravel\post;

describe('Customer Registration', function () {
    beforeEach(function () {
        Notification::fake();
    });

    it('registers a customer when reCAPTCHA is not configured', function () {
        config(['services.recaptcha.site_key' => null, 'services.recaptcha.secret_key' => null]);

        post(route('customer.auth.register.store'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertRedirect(route('customer.auth.email.notice'));

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeTrue();
    });

    it('requires a reCAPTCHA token when configured', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);

        post(route('customer.auth.register.store'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertSessionHasErrors('recaptcha_token');

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeFalse();
    });

    it('rejects registration when reCAPTCHA verification fails', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => false])]);

        post(route('customer.auth.register.store'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'bad-token',
        ])->assertSessionHasErrors('recaptcha_token');

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeFalse();
    });

    it('registers a customer when reCAPTCHA verification passes', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => true, 'score' => 0.9])]);

        post(route('customer.auth.register.store'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'good-token',
        ])->assertRedirect(route('customer.auth.email.notice'));

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeTrue();
    });

    it('rejects registration when the reCAPTCHA score is too low', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => true, 'score' => 0.1])]);

        post(route('customer.auth.register.store'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'bot-token',
        ])->assertSessionHasErrors('recaptcha_token');
    });
});
