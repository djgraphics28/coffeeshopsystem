<?php

use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;

describe('Admin Payment Settings', function () {
    beforeEach(function () {
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    });

    it('saves GCash and Maya details with QR code uploads', function () {
        Storage::fake('public');

        actingAs($this->admin)->put(route('admin.settings.update'), [
            'cafe_name' => 'Milk&Honey',
            'tax_rate' => 12,
            'currency' => '₱',
            'gcash_number' => '09171234567',
            'gcash_account_name' => 'Juan D.',
            'gcash_qr' => UploadedFile::fake()->image('gcash-qr.png'),
            'maya_number' => '09187654321',
            'maya_account_name' => 'Maria C.',
            'maya_qr' => UploadedFile::fake()->image('maya-qr.png'),
        ])->assertRedirect();

        expect(Setting::get('gcash_number'))->toBe('09171234567')
            ->and(Setting::get('maya_account_name'))->toBe('Maria C.')
            ->and(Setting::get('gcash_qr_path'))->not->toBeNull()
            ->and(Setting::get('maya_qr_path'))->not->toBeNull();

        Storage::disk('public')->assertExists(Setting::get('gcash_qr_path'));
        Storage::disk('public')->assertExists(Setting::get('maya_qr_path'));
    });

    it('replaces the old QR file when a new one is uploaded', function () {
        Storage::fake('public');
        $oldPath = UploadedFile::fake()->image('old.png')->store('payment-qr', 'public');
        Setting::set('gcash_qr_path', $oldPath);

        actingAs($this->admin)->put(route('admin.settings.update'), [
            'cafe_name' => 'Milk&Honey',
            'tax_rate' => 12,
            'currency' => '₱',
            'gcash_qr' => UploadedFile::fake()->image('new.png'),
        ])->assertRedirect();

        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists(Setting::get('gcash_qr_path'));
    });

    it('shows payment instructions data to storefront customers', function () {
        Setting::set('gcash_number', '09171234567');
        Setting::set('gcash_account_name', 'Juan D.');

        get(route('storefront.browse'))
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Customer/Storefront')
                ->where('settings.gcash_number', '09171234567')
                ->where('settings.gcash_account_name', 'Juan D.')
            );
    });

    it('rejects a non-image QR upload', function () {
        actingAs($this->admin)->put(route('admin.settings.update'), [
            'cafe_name' => 'Milk&Honey',
            'tax_rate' => 12,
            'currency' => '₱',
            'gcash_qr' => UploadedFile::fake()->create('not-an-image.pdf', 100, 'application/pdf'),
        ])->assertSessionHasErrors('gcash_qr');
    });
});
