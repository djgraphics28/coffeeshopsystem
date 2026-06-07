<?php

namespace Database\Seeders;

use App\Models\Table;
use Illuminate\Database\Seeder;

class TableSeeder extends Seeder
{
    public function run(): void
    {
        for ($i = 1; $i <= 10; $i++) {
            Table::firstOrCreate(
                ['name' => "Table {$i}"],
                ['sort_order' => $i]
            );
        }

        Table::firstOrCreate(
            ['name' => 'Takeout Counter'],
            ['sort_order' => 11]
        );
    }
}
