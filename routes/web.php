<?php

use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\AddonGroupController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DeliveryManController;
use App\Http\Controllers\Admin\ExpenseCategoryController;
use App\Http\Controllers\Admin\ExpenseController;
use App\Http\Controllers\Admin\MenuItemController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\PromoController as AdminPromoController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\TableController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Customer\CustomerAccountController;
use App\Http\Controllers\Customer\CustomerAuthController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\PromoController as CustomerPromoController;
use App\Http\Controllers\Customer\StorefrontController;
use App\Http\Controllers\Driver\DriverAuthController;
use App\Http\Controllers\Driver\DriverController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Kitchen\KitchenController;
use App\Http\Controllers\POS\PosController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');
Route::redirect('/welcome', '/login');

// Driver login (separate, rider-friendly sign-in page)
Route::get('driver/login', [DriverAuthController::class, 'showLogin'])->name('driver.login');
Route::post('driver/login', [DriverAuthController::class, 'login'])->name('driver.login.store')->middleware('throttle:10,1');

// Customer auth (public — must be before the /{qrToken} catch-all)
Route::prefix('order/auth')->name('customer.auth.')->group(function () {
    Route::get('/login/{qrToken?}', [CustomerAuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [CustomerAuthController::class, 'login'])->name('login.store')->middleware('throttle:10,1');
    Route::get('/register/{qrToken?}', [CustomerAuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [CustomerAuthController::class, 'register'])->name('register.store')->middleware('throttle:5,1');
    Route::post('/logout', [CustomerAuthController::class, 'logout'])->name('logout');

    // Email verification
    Route::get('/email/verify', [CustomerAuthController::class, 'showVerifyEmail'])->name('email.notice')->middleware('customer.session');
    Route::get('/email/verify/{id}/{hash}', [CustomerAuthController::class, 'verifyEmail'])->name('email.verify')->middleware('signed');
    Route::post('/email/resend', [CustomerAuthController::class, 'resendVerification'])->name('email.resend')->middleware(['customer.session', 'throttle:3,1']);
});

// Promo apply (customer must be logged in)
Route::post('/order/promo/apply', [CustomerPromoController::class, 'apply'])
    ->name('storefront.promo.apply')
    ->middleware('customer.auth');

// Customer account (order history & profile) — requires verified customer login
Route::prefix('order/my')->name('customer.account.')->middleware('customer.auth')->group(function () {
    Route::get('/orders', [CustomerAccountController::class, 'orders'])->name('orders');
    Route::get('/profile', [CustomerAccountController::class, 'profile'])->name('profile');
    Route::put('/profile', [CustomerAccountController::class, 'updateProfile'])->name('profile.update');
});

// Public storefront (QR self-order) — browsing is open to guests; placing an
// order requires a verified customer account (enforced in the controller)
Route::prefix('order')->name('storefront.')->group(function () {
    Route::get('/', [StorefrontController::class, 'browse'])->name('browse');
    Route::get('/{qrToken}', [StorefrontController::class, 'show'])->name('show')
        ->where('qrToken', '^(?!auth|promo)[a-zA-Z0-9_-]+$');
    Route::post('/', [CustomerOrderController::class, 'store'])->name('orders.store')->middleware('throttle:10,1');
    Route::get('/track/{order}', [CustomerOrderController::class, 'show'])->name('orders.show')->middleware('customer.auth');
    Route::get('/status/{order}', [CustomerOrderController::class, 'status'])->name('orders.status')->middleware('customer.auth');
    Route::post('/track/{order}/cancel', [CustomerOrderController::class, 'cancel'])->name('orders.cancel')->middleware('customer.auth');
});

// Authenticated app routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/home', HomeController::class)->name('home');
    Route::redirect('/dashboard', '/home');

    // Kitchen Display Screen
    Route::middleware('role:kitchen,admin')->prefix('kitchen')->name('kitchen.')->group(function () {
        Route::get('/', [KitchenController::class, 'index'])->name('index');
        Route::patch('/orders/{order}/status', [KitchenController::class, 'updateStatus'])->name('orders.update-status');
    });

    // Counter POS
    // Driver app — delivery riders manage their assigned orders
    Route::middleware('role:driver,admin')->prefix('driver')->name('driver.')->group(function () {
        Route::get('/', [DriverController::class, 'index'])->name('index');
        Route::post('orders/{order}/collect-payment', [DriverController::class, 'collectPayment'])->name('orders.collect-payment');
        Route::post('orders/{order}/delivered', [DriverController::class, 'markDelivered'])->name('orders.delivered');
    });

    Route::middleware('role:cashier,admin')->prefix('pos')->name('pos.')->group(function () {
        Route::get('/', [PosController::class, 'index'])->name('index');
        Route::post('/orders', [PosController::class, 'store'])->name('orders.store');
        Route::patch('/orders/{order}/status', [PosController::class, 'updateStatus'])->name('orders.update-status');
        Route::post('/orders/{order}/void', [PosController::class, 'void'])->name('orders.void');
        Route::post('/orders/{order}/payment', [PosController::class, 'processPayment'])->name('orders.payment');
        Route::get('/customers/search', [PosController::class, 'searchCustomers'])->name('customers.search');
        Route::post('/customers', [PosController::class, 'storeCustomer'])->name('customers.store');
    });

    // Admin Panel
    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/', [DashboardController::class, 'index'])->name('dashboard');
        Route::get('account', [AccountController::class, 'index'])->name('account');

        Route::resource('categories', CategoryController::class)->except(['show', 'edit', 'create']);
        Route::post('menu-items/bulk-price-update', [MenuItemController::class, 'bulkUpdatePrices'])->name('menu-items.bulk-price-update');
        Route::resource('menu-items', MenuItemController::class)->except(['show', 'edit', 'create']);
        Route::patch('menu-items/{menuItem}/toggle-availability', [MenuItemController::class, 'toggleAvailability'])->name('menu-items.toggle-availability');
        Route::resource('addon-groups', AddonGroupController::class)->except(['show', 'edit', 'create']);
        Route::resource('tables', TableController::class)->except(['show', 'edit', 'create']);
        Route::post('tables/{table}/regenerate-qr', [TableController::class, 'regenerateQr'])->name('tables.regenerate-qr');
        Route::resource('customers', CustomerController::class)->except(['edit', 'create']);
        Route::put('customers/{customer}/adjust-loyalty', [CustomerController::class, 'adjustLoyalty'])->name('customers.adjust-loyalty');
        Route::post('customers/{customer}/verify-email', [CustomerController::class, 'verifyEmail'])->name('customers.verify-email');
        Route::resource('promos', AdminPromoController::class)->except(['show', 'edit', 'create']);
        Route::resource('users', UserController::class)->except(['show', 'edit', 'create']);
        Route::resource('roles', RoleController::class)->except(['show', 'edit', 'create']);
        Route::patch('roles/{role}/toggle-permission', [RoleController::class, 'togglePermission'])->name('roles.toggle-permission');
        Route::post('roles/{role}/duplicate', [RoleController::class, 'duplicate'])->name('roles.duplicate');
        Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [AdminOrderController::class, 'show'])->name('orders.show');
        Route::patch('orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->name('orders.update-status');
        Route::post('orders/{order}/void', [AdminOrderController::class, 'void'])->name('orders.void');
        Route::patch('orders/{order}/delivery-man', [AdminOrderController::class, 'assignDeliveryMan'])->name('orders.assign-delivery-man');
        Route::post('orders/{order}/mark-paid', [AdminOrderController::class, 'markPaid'])->name('orders.mark-paid');
        Route::resource('delivery-men', DeliveryManController::class)->except(['show', 'edit', 'create'])->parameters(['delivery-men' => 'deliveryMan']);
        Route::put('delivery-men/{deliveryMan}/account', [DeliveryManController::class, 'saveAccount'])->name('delivery-men.account');
        Route::resource('expense-categories', ExpenseCategoryController::class)->except(['show', 'edit', 'create']);
        Route::resource('expenses', ExpenseController::class)->except(['show', 'edit', 'create']);

        Route::get('settings', [SettingsController::class, 'index'])->name('settings');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
    });
});

Route::get('/run-queue', function () {
    Artisan::call('queue:work --once');

    return 'Queue triggered';
});

require __DIR__.'/settings.php';
