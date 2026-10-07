<?php

namespace Database\Factories;

use App\Models\AddonGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AddonGroup>
 */
class AddonGroupFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'is_required' => false,
            'max_selections' => 1,
            'sort_order' => 0,
        ];
    }
}
