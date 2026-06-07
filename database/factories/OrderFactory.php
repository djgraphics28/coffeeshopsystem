<?php

namespace Database\Factories;

use App\Models\Table;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Order>
 */
class OrderFactory extends Factory
{
    public function definition(): array
    {
        $subtotal = $this->faker->randomFloat(2, 100, 800);
        $tax = round($subtotal * 0.12, 2);

        return [
            'table_id' => Table::factory(),
            'order_number' => 'MH-'.str_pad($this->faker->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'status' => $this->faker->randomElement(['pending', 'preparing', 'ready', 'completed']),
            'type' => $this->faker->randomElement(['dine-in', 'takeout', 'walkin']),
            'subtotal' => $subtotal,
            'tax' => $tax,
            'discount' => 0,
            'total' => $subtotal + $tax,
            'notes' => null,
            'created_by' => null,
        ];
    }

    public function pending(): static
    {
        return $this->state(['status' => 'pending']);
    }

    public function preparing(): static
    {
        return $this->state(['status' => 'preparing']);
    }

    public function ready(): static
    {
        return $this->state(['status' => 'ready']);
    }

    public function completed(): static
    {
        return $this->state(['status' => 'completed']);
    }
}
