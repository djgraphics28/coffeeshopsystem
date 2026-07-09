<?php

use App\Models\Customer;
use App\Models\Table;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

use function Pest\Laravel\post;

function customerVerificationUrl(Customer $customer): string
{
    return URL::temporarySignedRoute('customer.auth.email.verify', now()->addMinutes(60), [
        'id' => $customer->getKey(),
        'hash' => sha1($customer->getEmailForVerification()),
    ]);
}

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

    it('redirects to the storefront after verification when a table was scanned', function () {
        $table = Table::factory()->create();
        $customer = Customer::factory()->unverified()->create();

        $this->withSession([
            'storefront_qr_scan' => ['table_id' => $table->id, 'scanned_at' => now()->timestamp],
        ])->get(customerVerificationUrl($customer))
            ->assertRedirect(route('storefront.show', ['qrToken' => $table->qr_token]));

        expect($customer->fresh()->hasVerifiedEmail())->toBeTrue();
    });

    it('redirects to customer login after verification without any table context', function () {
        $customer = Customer::factory()->unverified()->create();

        $this->get(customerVerificationUrl($customer))
            ->assertRedirect(route('customer.auth.login'));

        expect($customer->fresh()->hasVerifiedEmail())->toBeTrue();
    });
});
