<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PromoController;
use App\Http\Controllers\Api\V1\SiteController;
use App\Http\Controllers\Api\V1\StorefrontController;
use Illuminate\Support\Facades\Route;

/*
| Customer ordering API, consumed by the Next.js frontend in /frontend.
| Customers authenticate with Sanctum bearer tokens.
*/
Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::get('site', [SiteController::class, 'show'])->name('site');
    Route::get('storefront', [StorefrontController::class, 'settings'])->name('storefront');
    Route::get('menu', [StorefrontController::class, 'menu'])->name('menu');
    Route::get('best-sellers', [StorefrontController::class, 'bestSellers'])->name('best-sellers');
    Route::get('tables/{qrToken}', [StorefrontController::class, 'table'])->name('tables.show');

    Route::prefix('auth')->name('auth.')->group(function () {
        Route::post('register', [AuthController::class, 'register'])->middleware('throttle:5,1')->name('register');
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('login');
    });

    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::put('me', [ProfileController::class, 'update'])->name('me.update');
        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::post('auth/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:3,1')->name('auth.email.resend');

        Route::get('orders', [OrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [OrderController::class, 'show'])->name('orders.show');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->name('orders.cancel');

        Route::middleware('customer:verified')->group(function () {
            Route::post('orders', [OrderController::class, 'store'])->middleware('throttle:10,1')->name('orders.store');
            Route::post('promos/apply', [PromoController::class, 'apply'])->name('promos.apply');
        });
    });
});
