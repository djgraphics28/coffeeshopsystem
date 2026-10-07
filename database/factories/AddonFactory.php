<?php

namespace Database\Factories;

use App\Models\Addon;
use App\Models\AddonGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Addon>
 */
class AddonFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'addon_group_id' => AddonGroup::factory(),
            'name' => fake()->unique()->word(),
            'additional_price' => 0,
            'sort_order' => 0,
        ];
    }
}
