<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100)->unique();
            $table->string('description')->nullable();
            // Employees in a driver position are mirrored into the delivery men list automatically.
            $table->boolean('is_driver')->default(false);
            // Login role given to an employee's system account for this position (e.g. cashier, kitchen).
            $table->string('system_role', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();

        DB::table('positions')->insert(collect([
            ['Manager', null, false],
            ['Cashier', 'cashier', false],
            ['Barista', 'barista', false],
            ['Kitchen Staff', 'kitchen', false],
            ['Server', null, false],
            ['Driver', 'driver', true],
            ['Utility', null, false],
        ])->map(fn (array $p) => [
            'name' => $p[0], 'system_role' => $p[1], 'is_driver' => $p[2], 'is_active' => true, 'created_at' => $now, 'updated_at' => $now,
        ])->all());
    }

    public function down(): void
    {
        Schema::dropIfExists('positions');
    }
};
