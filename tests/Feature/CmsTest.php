<?php

use App\Models\Banner;
use App\Models\GalleryImage;
use App\Models\Setting;
use App\Models\User;
use App\Support\SiteContent;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\get;
use function Pest\Laravel\getJson;

beforeEach(function () {
    Storage::fake('public');
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
});

describe('CMS Site Content', function () {
    it('shows the site content editor to admins', function () {
        actingAs($this->admin)->get(route('admin.cms.content.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Cms/SiteContent')->has('content')->has('defaults'));
    });

    it('blocks non-admins', function () {
        actingAs(User::factory()->create())->get(route('admin.cms.content.edit'))->assertForbidden();
    });

    it('sends guests to sign in', function () {
        get(route('admin.cms.content.edit'))->assertRedirect();
    });

    it('saves text and a hero image', function () {
        actingAs($this->admin)->put(route('admin.cms.content.update'), [
            'hero_title' => 'Brewed for you',
            'address' => '123 Honey St.',
            'instagram_url' => 'https://instagram.com/milkandhoney',
            'hero_image' => UploadedFile::fake()->image('hero.jpg', 1200, 800),
        ])->assertRedirect();

        expect(Setting::get('cms_hero_title'))->toBe('Brewed for you')
            ->and(Setting::get('cms_address'))->toBe('123 Honey St.');

        Storage::disk('public')->assertExists(Setting::get('cms_hero_image_path'));
    });

    it('removes a saved image', function () {
        Storage::disk('public')->put('cms/old.jpg', 'x');
        Setting::set('cms_about_image_path', 'cms/old.jpg');

        actingAs($this->admin)->put(route('admin.cms.content.update'), ['remove_about_image' => true])->assertRedirect();

        Storage::disk('public')->assertMissing('cms/old.jpg');
        expect(Setting::get('cms_about_image_path'))->toBeNull();
    });

    it('saves the map pin and exposes it to the storefront', function () {
        actingAs($this->admin)->put(route('admin.cms.content.update'), [
            'map_lat' => '14.653712',
            'map_lng' => '121.068934',
        ])->assertRedirect();

        getJson(route('api.v1.site'))
            ->assertJsonPath('data.content.map_lat', '14.653712')
            ->assertJsonPath('data.content.map_lng', '121.068934');
    });

    it('rejects a half or out-of-range map pin', function () {
        actingAs($this->admin)->put(route('admin.cms.content.update'), ['map_lat' => '14.65'])
            ->assertSessionHasErrors('map_lng');

        actingAs($this->admin)->put(route('admin.cms.content.update'), ['map_lat' => '95', 'map_lng' => '121'])
            ->assertSessionHasErrors('map_lat');
    });

    it('rejects invalid links', function () {
        actingAs($this->admin)->put(route('admin.cms.content.update'), ['facebook_url' => 'not a link'])
            ->assertSessionHasErrors('facebook_url');
    });

    it('falls back to default copy for empty fields', function () {
        Setting::set('cms_hero_title', '');

        expect(SiteContent::all()['hero_title'])->toBe(SiteContent::DEFAULTS['hero_title']);
    });
});

describe('CMS Location', function () {
    it('shows the location editor to admins', function () {
        Setting::set('cms_map_lat', '14.6406');

        actingAs($this->admin)->get(route('admin.cms.location.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Cms/Location')->where('location.map_lat', '14.6406'));
    });

    it('blocks non-admins', function () {
        actingAs(User::factory()->create())->get(route('admin.cms.location.edit'))->assertForbidden();
    });

    it('saves the address, pin and maps link only', function () {
        Setting::set('cms_hero_title', 'Keep me');

        actingAs($this->admin)->put(route('admin.cms.location.update'), [
            'address' => '88 Maginhawa St., Quezon City',
            'map_lat' => '14.640600',
            'map_lng' => '121.066000',
            'map_url' => 'https://maps.app.goo.gl/example',
            'hero_title' => 'Should be ignored',
        ])->assertRedirect();

        expect(Setting::get('cms_address'))->toBe('88 Maginhawa St., Quezon City')
            ->and(Setting::get('cms_map_lat'))->toBe('14.640600')
            ->and(Setting::get('cms_map_url'))->toBe('https://maps.app.goo.gl/example')
            ->and(Setting::get('cms_hero_title'))->toBe('Keep me');
    });

    it('clears the pin when both coordinates are emptied', function () {
        Setting::set('cms_map_lat', '14.6');
        Setting::set('cms_map_lng', '121.0');

        actingAs($this->admin)->put(route('admin.cms.location.update'), ['map_lat' => '', 'map_lng' => ''])->assertRedirect();

        getJson(route('api.v1.site'))->assertJsonPath('data.content.map_lat', '')->assertJsonPath('data.content.map_lng', '');
    });

    it('rejects an invalid pin', function () {
        actingAs($this->admin)->put(route('admin.cms.location.update'), ['map_lat' => '14.6'])
            ->assertSessionHasErrors('map_lng');
    });
});

describe('CMS Banners', function () {
    it('lists banners for admins', function () {
        Banner::factory()->create(['title' => 'Love Month']);

        actingAs($this->admin)->get(route('admin.cms.banners.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Admin/Cms/Banners')->where('banners.0.title', 'Love Month')->where('banners.0.is_live', true));
    });

    it('creates a scheduled banner with an image', function () {
        actingAs($this->admin)->post(route('admin.cms.banners.store'), [
            'title' => 'Christmas Blend',
            'badge' => 'Holiday',
            'theme' => 'christmas',
            'cta_label' => 'Order now',
            'cta_url' => '/menu',
            'starts_at' => '2026-12-01 00:00',
            'ends_at' => '2026-12-31 23:59',
            'is_active' => true,
            'image' => UploadedFile::fake()->image('xmas.jpg'),
        ])->assertRedirect(route('admin.cms.banners.index'));

        $banner = Banner::firstWhere('title', 'Christmas Blend');
        expect($banner->theme)->toBe('christmas')
            ->and($banner->image_url)->not->toBeNull();
    });

    it('validates theme and schedule order', function () {
        actingAs($this->admin)->post(route('admin.cms.banners.store'), [
            'title' => 'Bad',
            'theme' => 'neon',
            'starts_at' => '2026-12-31',
            'ends_at' => '2026-12-01',
        ])->assertSessionHasErrors(['theme', 'ends_at']);
    });

    it('updates and deletes a banner', function () {
        $banner = Banner::factory()->create();

        actingAs($this->admin)->put(route('admin.cms.banners.update', $banner), [
            'title' => 'Updated',
            'theme' => 'love',
            'is_active' => false,
        ])->assertRedirect();

        expect($banner->fresh()->title)->toBe('Updated')->and($banner->fresh()->is_active)->toBeFalse();

        actingAs($this->admin)->delete(route('admin.cms.banners.destroy', $banner))->assertRedirect();

        expect(Banner::count())->toBe(0);
    });
});

describe('CMS Gallery', function () {
    it('uploads several photos at once', function () {
        actingAs($this->admin)->post(route('admin.cms.gallery.store'), [
            'images' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
        ])->assertRedirect(route('admin.cms.gallery.index'));

        expect(GalleryImage::count())->toBe(2)
            ->and(GalleryImage::first()->image_url)->not->toBeNull();
    });

    it('rejects non-image uploads', function () {
        actingAs($this->admin)->post(route('admin.cms.gallery.store'), [
            'images' => [UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')],
        ])->assertSessionHasErrors('images.0');
    });

    it('updates a caption and visibility, then deletes', function () {
        $image = GalleryImage::factory()->create();

        actingAs($this->admin)->put(route('admin.cms.gallery.update', $image), ['caption' => 'Our bar', 'is_active' => false])->assertRedirect();
        expect($image->fresh()->caption)->toBe('Our bar')->and($image->fresh()->is_active)->toBeFalse();

        actingAs($this->admin)->delete(route('admin.cms.gallery.destroy', $image))->assertRedirect();
        expect(GalleryImage::count())->toBe(0);
    });
});

describe('Site API', function () {
    it('returns content with defaults, only live banners, and visible photos', function () {
        Setting::set('cms_hero_title', 'Hello coffee');
        Banner::factory()->create(['title' => 'Live now']);
        Banner::factory()->inactive()->create(['title' => 'Hidden']);
        Banner::factory()->create(['title' => 'Future', 'starts_at' => now()->addWeek()]);
        Banner::factory()->create(['title' => 'Over', 'ends_at' => now()->subDay()]);

        $visible = GalleryImage::factory()->create();
        $visible->addMedia(UploadedFile::fake()->image('v.jpg'))->toMediaCollection('image');
        $hidden = GalleryImage::factory()->create(['is_active' => false]);
        $hidden->addMedia(UploadedFile::fake()->image('h.jpg'))->toMediaCollection('image');

        getJson(route('api.v1.site'))
            ->assertOk()
            ->assertJsonPath('data.content.hero_title', 'Hello coffee')
            ->assertJsonPath('data.content.about_title', SiteContent::DEFAULTS['about_title'])
            ->assertJsonCount(1, 'data.banners')
            ->assertJsonPath('data.banners.0.title', 'Live now')
            ->assertJsonCount(1, 'data.gallery')
            ->assertJsonPath('data.gallery.0.id', $visible->id);
    });
});
