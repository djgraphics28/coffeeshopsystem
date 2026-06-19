<?php

use App\Models\User;

test('guests are redirected to the login page', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
});

test('admin users are redirected to admin dashboard', function () {
    $user = User::factory()->create();
    $user->assignRole('admin');

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('admin.dashboard'));
});

test('cashier users are redirected to pos', function () {
    $user = User::factory()->create();
    $user->assignRole('cashier');

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('pos.index'));
});

test('kitchen users are redirected to kitchen display', function () {
    $user = User::factory()->create();
    $user->assignRole('kitchen');

    $this->actingAs($user)
        ->get(route('home'))
        ->assertRedirect(route('kitchen.index'));
});

test('dashboard route redirects to home', function () {
    $user = User::factory()->create();
    $user->assignRole('admin');

    $this->actingAs($user)
        ->get('/dashboard')
        ->assertRedirect(route('home'));
});
