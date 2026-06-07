<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Espresso Classics', 'icon' => '☕', 'sort_order' => 1],
            ['name' => 'Cold Brews', 'icon' => '🧊', 'sort_order' => 2],
            ['name' => 'Milk Teas', 'icon' => '🧋', 'sort_order' => 3],
            ['name' => 'Refreshers', 'icon' => '🍹', 'sort_order' => 4],
            ['name' => 'All-Day Breakfast', 'icon' => '🍳', 'sort_order' => 5],
            ['name' => 'Pastries & Bites', 'icon' => '🥐', 'sort_order' => 6],
        ];

        foreach ($categories as $data) {
            Category::firstOrCreate(['name' => $data['name']], $data);
        }
    }
}
