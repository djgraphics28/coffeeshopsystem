<?php

use App\Models\Customer;
use App\Models\Setting;
use App\Notifications\CustomerVerifyEmail;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\get;
use function Pest\Laravel\postJson;

function customerVerificationUrl(Customer $customer): string
{
    return URL::temporarySignedRoute('customer.email.verify', now()->addMinutes(60), [
        'id' => $customer->getKey(),
        'hash' => sha1($customer->getEmailForVerification()),
    ]);
}

describe('Customer Registration API', function () {
    beforeEach(function () {
        Notification::fake();
        config(['app.frontend_url' => 'https://order.example.com']);
    });

    it('registers a customer, sends verification and returns a token', function () {
        config(['services.recaptcha.site_key' => null, 'services.recaptcha.secret_key' => null]);

        postJson(route('api.v1.auth.register'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()
            ->assertJsonStructure(['token', 'customer' => ['id', 'email', 'email_verified']])
            ->assertJsonPath('customer.email_verified', false);

        $customer = Customer::where('email', 'juan@example.com')->firstOrFail();
        Notification::assertSentTo($customer, CustomerVerifyEmail::class);
    });

    it('skips verification when the admin turned it off', function () {
        config(['services.recaptcha.site_key' => null, 'services.recaptcha.secret_key' => null]);
        Setting::set('customer_email_verification', '0');

        postJson(route('api.v1.auth.register'), [
            'name' => 'Ana Santos',
            'email' => 'ana@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated()->assertJsonPath('customer.email_verified', true);

        Notification::assertNothingSent();
    });

    it('requires a reCAPTCHA token when configured', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);

        postJson(route('api.v1.auth.register'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()->assertInvalid('recaptcha_token');

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeFalse();
    });

    it('rejects registration when reCAPTCHA verification fails', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => false])]);

        postJson(route('api.v1.auth.register'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'bad-token',
        ])->assertInvalid('recaptcha_token');

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeFalse();
    });

    it('registers a customer when reCAPTCHA verification passes', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => true, 'score' => 0.9])]);

        postJson(route('api.v1.auth.register'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'good-token',
        ])->assertCreated();

        expect(Customer::where('email', 'juan@example.com')->exists())->toBeTrue();
    });

    it('rejects registration when the reCAPTCHA score is too low', function () {
        config(['services.recaptcha.site_key' => 'site-key', 'services.recaptcha.secret_key' => 'secret-key']);
        Http::fake(['www.google.com/recaptcha/*' => Http::response(['success' => true, 'score' => 0.1])]);

        postJson(route('api.v1.auth.register'), [
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'recaptcha_token' => 'bot-token',
        ])->assertInvalid('recaptcha_token');
    });

    it('verifies the email and redirects to the frontend', function () {
        $customer = Customer::factory()->unverified()->create();

        get(customerVerificationUrl($customer))
            ->assertRedirect('https://order.example.com/verify-email?status=verified');

        expect($customer->fresh()->hasVerifiedEmail())->toBeTrue();
    });

    it('redirects an invalid verification link to the frontend with an error', function () {
        $customer = Customer::factory()->unverified()->create();

        get(route('customer.email.verify', ['id' => $customer->id, 'hash' => 'tampered']))
            ->assertRedirect('https://order.example.com/verify-email?status=invalid');

        expect($customer->fresh()->hasVerifiedEmail())->toBeFalse();
    });

    it('resends the verification email', function () {
        $customer = Customer::factory()->unverified()->create();
        Sanctum::actingAs($customer);

        postJson(route('api.v1.auth.email.resend'))->assertOk();

        Notification::assertSentTo($customer, CustomerVerifyEmail::class);
    });
});

describe('Customer Login API', function () {
    it('logs in with valid credentials and returns a token', function () {
        $customer = Customer::factory()->create(['password' => 'password123']);

        postJson(route('api.v1.auth.login'), [
            'email' => $customer->email,
            'password' => 'password123',
        ])->assertOk()
            ->assertJsonStructure(['token', 'customer'])
            ->assertJsonPath('customer.id', $customer->id);
    });

    it('rejects invalid credentials', function () {
        $customer = Customer::factory()->create(['password' => 'password123']);

        postJson(route('api.v1.auth.login'), [
            'email' => $customer->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable()->assertInvalid('email');
    });

    it('revokes the token on logout', function () {
        $customer = Customer::factory()->create();
        $token = $customer->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson(route('api.v1.auth.logout'))->assertOk();

        expect($customer->tokens()->count())->toBe(0);
    });
});
