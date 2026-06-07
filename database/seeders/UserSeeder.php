<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $cashierRole = Role::firstOrCreate(['name' => 'cashier']);
        $kitchenRole = Role::firstOrCreate(['name' => 'kitchen']);

        $admin = User::firstOrCreate(
            ['email' => 'admin@milkandhoney.com'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
        $admin->assignRole($adminRole);

        $cashier = User::firstOrCreate(
            ['email' => 'cashier@milkandhoney.com'],
            [
                'name' => 'Cashier User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
        $cashier->assignRole($cashierRole);

        $kitchen = User::firstOrCreate(
            ['email' => 'kitchen@milkandhoney.com'],
            [
                'name' => 'Kitchen Staff',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
        $kitchen->assignRole($kitchenRole);
    }
}
