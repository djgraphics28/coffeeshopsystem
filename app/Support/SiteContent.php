<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * The storefront website's editable copy and images (the "Site Content" CMS page).
 * Values live in the settings table under `cms_*` keys; anything not yet edited
 * falls back to the defaults below so the website always looks complete.
 */
class SiteContent
{
    /** @var list<string> */
    public const IMAGE_FIELDS = ['hero_image', 'about_image'];

    /**
     * @var array<string, string>
     */
    public const DEFAULTS = [
        'hero_eyebrow' => 'Specialty coffee · Est. 2021',
        'hero_title' => 'Slow-brewed coffee, sweetened by honey.',
        'hero_subtitle' => 'A neighbourhood café for honest espresso, silky milk teas and pastries baked every morning.',
        'hero_cta_label' => 'Order online',
        'about_title' => 'Our story',
        'about_body' => "Milk & Honey started as a tiny corner bar with one espresso machine and a big idea: great coffee should feel like home.\n\nToday we still roast in small batches, sweeten with wildflower honey from local farms and bake everything in-house — so every cup and every bite is made with care.",
        'highlight_1_icon' => '☕',
        'highlight_1_title' => 'Small-batch roasts',
        'highlight_1_text' => 'Beans roasted weekly for a fresh, balanced cup.',
        'highlight_2_icon' => '🍯',
        'highlight_2_title' => 'Local honey',
        'highlight_2_text' => 'Sweetened naturally with wildflower honey from nearby farms.',
        'highlight_3_icon' => '🥐',
        'highlight_3_title' => 'Baked every morning',
        'highlight_3_text' => 'Croissants, breads and bites fresh from our oven.',
        'address' => '',
        'map_url' => '',
        'map_lat' => '',
        'map_lng' => '',
        'phone' => '',
        'email' => '',
        'hours' => '',
        'facebook_url' => '',
        'instagram_url' => '',
        'tiktok_url' => '',
    ];

    /**
     * Validation rules for the Site Content form.
     *
     * @return array<string, list<string>>
     */
    public static function rules(): array
    {
        $rules = [];

        foreach (array_keys(self::DEFAULTS) as $field) {
            $rules[$field] = ['nullable', 'string', str_contains($field, 'body') || $field === 'hours' ? 'max:3000' : 'max:255'];
        }

        foreach (['map_url', 'facebook_url', 'instagram_url', 'tiktok_url'] as $urlField) {
            $rules[$urlField][] = 'url';
        }

        $rules['email'][] = 'email';

        // The pin on the storefront map; both or neither.
        $rules['map_lat'] = ['nullable', 'numeric', 'between:-90,90', 'required_with:map_lng'];
        $rules['map_lng'] = ['nullable', 'numeric', 'between:-180,180', 'required_with:map_lat'];

        foreach (self::IMAGE_FIELDS as $imageField) {
            $rules[$imageField] = ['nullable', 'image', 'max:4096'];
            $rules["remove_{$imageField}"] = ['nullable', 'boolean'];
        }

        return $rules;
    }

    /**
     * Every field with its saved value (or default), plus public image URLs.
     *
     * @return array<string, string|null>
     */
    public static function all(): array
    {
        $content = self::editable();

        foreach (self::DEFAULTS as $field => $default) {
            if ($content[$field] === null || $content[$field] === '') {
                $content[$field] = $default;
            }
        }

        return $content;
    }

    /**
     * Only what the admin has saved (empty when still on the default), plus image URLs — for the CMS form.
     *
     * @return array<string, string|null>
     */
    public static function editable(): array
    {
        $saved = Setting::query()->where('key', 'like', 'cms_%')->pluck('value', 'key');
        $content = [];

        foreach (array_keys(self::DEFAULTS) as $field) {
            $content[$field] = $saved->get("cms_{$field}");
        }

        foreach (self::IMAGE_FIELDS as $imageField) {
            $path = $saved->get("cms_{$imageField}_path");
            $content["{$imageField}_url"] = $path ? Storage::disk('public')->url($path) : null;
        }

        return $content;
    }

    /**
     * Save the form: text fields, new images (replacing old files) and image removals.
     *
     * @param  array<string, mixed>  $validated
     * @param  array<string, UploadedFile|null>  $images
     */
    public static function update(array $validated, array $images): void
    {
        foreach (array_keys(self::DEFAULTS) as $field) {
            if (array_key_exists($field, $validated)) {
                Setting::set("cms_{$field}", trim((string) $validated[$field]));
            }
        }

        foreach (self::IMAGE_FIELDS as $imageField) {
            $key = "cms_{$imageField}_path";
            $upload = $images[$imageField] ?? null;

            if (! $upload && empty($validated["remove_{$imageField}"])) {
                continue;
            }

            $oldPath = Setting::get($key);

            if ($oldPath) {
                Storage::disk('public')->delete($oldPath);
            }

            Setting::set($key, $upload?->store('cms', 'public'));
        }
    }
}
