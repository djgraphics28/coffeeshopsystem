<?php

use App\Http\Controllers\Admin\AddonGroupController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\MenuItemController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\TableController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\StorefrontController;
use App\Http\Controllers\Kitchen\KitchenController;
use App\Http\Controllers\POS\PosController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login')->name('home');

// Public storefront (QR self-order)
Route::prefix('order')->name('storefront.')->group(function () {
    Route::get('/{qrToken}', [StorefrontController::class, 'show'])->name('show');
    Route::post('/', [CustomerOrderController::class, 'store'])->name('orders.store')->middleware('throttle:10,1');
    Route::get('/track/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
    Route::get('/status/{order}', [CustomerOrderController::class, 'status'])->name('orders.status');
});

// Authenticated app routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Kitchen Display Screen
    Route::middleware('role:kitchen,admin')->prefix('kitchen')->name('kitchen.')->group(function () {
        Route::get('/', [KitchenController::class, 'index'])->name('index');
        Route::patch('/orders/{order}/status', [KitchenController::class, 'updateStatus'])->name('orders.update-status');
    });

    // Counter POS
    Route::middleware('role:cashier,admin')->prefix('pos')->name('pos.')->group(function () {
        Route::get('/', [PosController::class, 'index'])->name('index');
        Route::post('/orders', [PosController::class, 'store'])->name('orders.store');
        Route::patch('/orders/{order}/status', [PosController::class, 'updateStatus'])->name('orders.update-status');
        Route::post('/orders/{order}/payment', [PosController::class, 'processPayment'])->name('orders.payment');
    });

    // Admin Panel
    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

        Route::resource('categories', CategoryController::class)->except(['show', 'edit', 'create']);
        Route::resource('menu-items', MenuItemController::class)->except(['show', 'edit', 'create']);
        Route::resource('addon-groups', AddonGroupController::class)->except(['show', 'edit', 'create']);
        Route::resource('tables', TableController::class)->except(['show', 'edit', 'create']);
        Route::post('tables/{table}/regenerate-qr', [TableController::class, 'regenerateQr'])->name('tables.regenerate-qr');
        Route::resource('users', UserController::class)->except(['show', 'edit', 'create']);
        Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [AdminOrderController::class, 'show'])->name('orders.show');
        Route::patch('orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->name('orders.update-status');
        Route::get('settings', [SettingsController::class, 'index'])->name('settings');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
    });
});

Route::get('/run-queue', function () {
    Artisan::call('queue:work --once');
    return 'Queue triggered';
});

require __DIR__.'/settings.php';
