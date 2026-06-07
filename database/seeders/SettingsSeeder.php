<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'cafe_name' => "Milk&Honey Cafe'",
            'cafe_tagline' => 'Crafted with love, served with warmth.',
            'tax_rate' => '12',
            'currency' => '₱',
            'currency_code' => 'PHP',
            'opening_time' => '07:00',
            'closing_time' => '21:00',
            'estimated_wait_minutes' => '10-15',
        ];

        foreach ($defaults as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
