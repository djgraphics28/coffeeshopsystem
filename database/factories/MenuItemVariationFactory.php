<?php

namespace Database\Factories;

use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MenuItemVariation>
 */
class MenuItemVariationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'menu_item_id' => MenuItem::factory(),
            'name' => $this->faker->randomElement(['Small', 'Medium', 'Large']),
            'price' => $this->faker->randomFloat(2, 100, 300),
            'sort_order' => $this->faker->numberBetween(1, 5),
        ];
    }
}
