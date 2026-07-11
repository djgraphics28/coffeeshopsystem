<?php

namespace Database\Factories;

use App\Models\DeliveryMan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryMan>
 */
class DeliveryManFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => $this->faker->name(),
            'phone' => '09'.$this->faker->numerify('#########'),
            'vehicle' => $this->faker->randomElement(['Motorcycle', 'Bicycle', 'Scooter']),
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }
}
