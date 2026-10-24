<?php

use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\Admin\AddonGroupController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\Cms\BannerController as CmsBannerController;
use App\Http\Controllers\Admin\Cms\GalleryImageController as CmsGalleryImageController;
use App\Http\Controllers\Admin\Cms\LocationController as CmsLocationController;
use App\Http\Controllers\Admin\Cms\SiteContentController as CmsSiteContentController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DeliveryManController;
use App\Http\Controllers\Admin\ExpenseCategoryController;
use App\Http\Controllers\Admin\ExpenseController;
use App\Http\Controllers\Admin\Hr\AttendanceController as HrAttendanceController;
use App\Http\Controllers\Admin\Hr\EmployeeController;
use App\Http\Controllers\Admin\Hr\PayrollController;
use App\Http\Controllers\Admin\Hr\PositionController;
use App\Http\Controllers\Admin\MenuItemController;
use App\Http\Controllers\Admin\OnlineOrderController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\PromoController as AdminPromoController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\SystemController;
use App\Http\Controllers\Admin\TableController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AttendanceKioskController;
use App\Http\Controllers\Customer\VerifyEmailController;
use App\Http\Controllers\Driver\DriverAuthController;
use App\Http\Controllers\Driver\DriverController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Kitchen\StationController;
use App\Http\Controllers\POS\PosController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/login');
Route::redirect('/welcome', '/login');

// Attendance screen: employees clock in / out by scanning their QR code or typing their employee ID (no sign-in needed).
Route::get('attendance', [AttendanceKioskController::class, 'show'])->name('attendance.kiosk');
Route::post('attendance/punch', [AttendanceKioskController::class, 'punch'])->middleware('throttle:attendance-punch')->name('attendance.punch');
Route::post('attendance/face', [AttendanceKioskController::class, 'punchByFace'])->middleware('throttle:attendance-punch')->name('attendance.face');

// Driver login (separate, rider-friendly sign-in page)
Route::get('driver/login', [DriverAuthController::class, 'showLogin'])->name('driver.login');
Route::post('driver/login', [DriverAuthController::class, 'login'])->name('driver.login.store')->middleware('throttle:10,1');

// Customer ordering lives in the Next.js frontend (/frontend) backed by routes/api.php.
// Signed link from the customer verification email.
Route::get('customer/email/verify/{id}/{hash}', VerifyEmailController::class)->name('customer.email.verify');

// Older printed table QR codes point at /order/{qrToken} — forward them to the frontend.
Route::get('order/{qrToken?}', function (?string $qrToken = null) {
    $frontendUrl = rtrim(config('app.frontend_url'), '/');

    return redirect()->away($qrToken ? "{$frontendUrl}/t/{$qrToken}" : $frontendUrl);
})->where('qrToken', '[a-zA-Z0-9_-]+')->name('storefront.redirect');

// Authenticated app routes
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/home', HomeController::class)->name('home');
    Route::redirect('/dashboard', '/home');

    // Preparation stations: the kitchen cooks `is_kitchen` items, the barista makes everything else.
    foreach (['kitchen' => 'kitchen,admin', 'barista' => 'barista,admin'] as $station => $roles) {
        Route::middleware("role:{$roles}")->prefix($station)->name("{$station}.")->group(function () use ($station) {
            Route::get('/', [StationController::class, 'index'])->name('index')->defaults('station', $station);
            Route::patch('/orders/{order}/status', [StationController::class, 'updateStatus'])->name('orders.update-status')->defaults('station', $station);
            Route::patch('/order-items/{orderItem}', [StationController::class, 'toggleItem'])->name('order-items.toggle')->defaults('station', $station);
            Route::post('/orders/{order}/check-all', [StationController::class, 'checkAll'])->name('orders.check-all')->defaults('station', $station);
        });
    }

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
        Route::get('menu-items/import/template', [MenuItemController::class, 'importTemplate'])->name('menu-items.import.template');
        Route::post('menu-items/import', [MenuItemController::class, 'import'])->name('menu-items.import');
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
        // Online storefront orders: accept / decline, plus the alert feed polled by every admin page
        Route::get('online-orders', [OnlineOrderController::class, 'index'])->name('online-orders.index');
        Route::get('online-orders/pulse', [OnlineOrderController::class, 'pulse'])->name('online-orders.pulse');
        Route::post('online-orders/{order}/accept', [OnlineOrderController::class, 'accept'])->name('online-orders.accept');
        Route::post('online-orders/{order}/decline', [OnlineOrderController::class, 'decline'])->name('online-orders.decline');

        Route::get('orders', [AdminOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [AdminOrderController::class, 'show'])->name('orders.show');
        Route::patch('orders/{order}/status', [AdminOrderController::class, 'updateStatus'])->name('orders.update-status');
        Route::post('orders/{order}/void', [AdminOrderController::class, 'void'])->name('orders.void');
        Route::patch('orders/{order}/delivery-man', [AdminOrderController::class, 'assignDeliveryMan'])->name('orders.assign-delivery-man');
        Route::post('orders/{order}/mark-paid', [AdminOrderController::class, 'markPaid'])->name('orders.mark-paid');
        Route::resource('delivery-men', DeliveryManController::class)->except(['show', 'edit', 'create'])->parameters(['delivery-men' => 'deliveryMan']);
        Route::put('delivery-men/{deliveryMan}/account', [DeliveryManController::class, 'saveAccount'])->name('delivery-men.account');
        Route::resource('expense-categories', ExpenseCategoryController::class)->only(['store', 'update', 'destroy']);
        Route::resource('expenses', ExpenseController::class)->except(['show', 'edit', 'create']);
        Route::get('reports', [ReportController::class, 'index'])->name('reports');

        // Human Resource: employees, attendance and payroll
        Route::prefix('hr')->name('hr.')->group(function () {
            Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');
            Route::get('employees/cards', [EmployeeController::class, 'cards'])->name('employees.cards');
            Route::post('employees', [EmployeeController::class, 'store'])->name('employees.store');
            Route::put('employees/{employee}', [EmployeeController::class, 'update'])->name('employees.update');
            Route::delete('employees/{employee}', [EmployeeController::class, 'destroy'])->name('employees.destroy');
            Route::post('employees/{employee}/face', [EmployeeController::class, 'enrollFace'])->name('employees.face.store');
            Route::delete('employees/{employee}/face', [EmployeeController::class, 'removeFace'])->name('employees.face.destroy');

            Route::post('positions', [PositionController::class, 'store'])->name('positions.store');
            Route::post('positions/defaults', [PositionController::class, 'defaults'])->name('positions.defaults');
            Route::put('positions/{position}', [PositionController::class, 'update'])->name('positions.update');
            Route::delete('positions/{position}', [PositionController::class, 'destroy'])->name('positions.destroy');

            Route::get('attendance', [HrAttendanceController::class, 'index'])->name('attendance.index');
            Route::post('attendance', [HrAttendanceController::class, 'store'])->name('attendance.store');
            Route::put('attendance/{attendance}', [HrAttendanceController::class, 'update'])->name('attendance.update');
            Route::delete('attendance/{attendance}', [HrAttendanceController::class, 'destroy'])->name('attendance.destroy');

            Route::get('payroll', [PayrollController::class, 'index'])->name('payroll.index');
            Route::post('payroll', [PayrollController::class, 'store'])->name('payroll.store');
            Route::put('payroll/settings', [PayrollController::class, 'updateSettings'])->name('payroll.settings');
            Route::post('payroll/payslips/{payslip}/adjustments', [PayrollController::class, 'addAdjustment'])->name('payroll.adjustments.store');
            Route::delete('payroll/adjustments/{adjustment}', [PayrollController::class, 'deleteAdjustment'])->name('payroll.adjustments.destroy');
            Route::get('payroll/{run}', [PayrollController::class, 'show'])->name('payroll.show');
            Route::get('payroll/{run}/payslips/{payslip}', [PayrollController::class, 'payslip'])->name('payroll.payslip');
            Route::post('payroll/{run}/recalculate', [PayrollController::class, 'recalculate'])->name('payroll.recalculate');
            Route::post('payroll/{run}/approve', [PayrollController::class, 'approve'])->name('payroll.approve');
            Route::post('payroll/{run}/pay', [PayrollController::class, 'pay'])->name('payroll.pay');
            Route::delete('payroll/{run}', [PayrollController::class, 'destroy'])->name('payroll.destroy');
        });

        // CMS: the storefront website's content, promo / event banners and photo gallery
        Route::prefix('cms')->name('cms.')->group(function () {
            Route::get('content', [CmsSiteContentController::class, 'edit'])->name('content.edit');
            Route::put('content', [CmsSiteContentController::class, 'update'])->name('content.update');
            Route::get('location', [CmsLocationController::class, 'edit'])->name('location.edit');
            Route::put('location', [CmsLocationController::class, 'update'])->name('location.update');
            Route::resource('banners', CmsBannerController::class)->only(['index', 'store', 'update', 'destroy']);
            Route::resource('gallery', CmsGalleryImageController::class)->only(['index', 'store', 'update', 'destroy'])->parameters(['gallery' => 'galleryImage']);
        });

        // System: database backups, restore and reset
        Route::get('system', [SystemController::class, 'index'])->name('system');
        Route::post('system/backups', [SystemController::class, 'storeBackup'])->middleware('throttle:backup-create')->name('system.backups.store');
        Route::post('system/backups/import', [SystemController::class, 'importBackup'])->middleware('throttle:backup-import')->name('system.backups.import');
        Route::get('system/backups/{file}/download', [SystemController::class, 'downloadBackup'])->where('file', '[A-Za-z0-9._-]+\.zip')->name('system.backups.download');
        Route::delete('system/backups/{file}', [SystemController::class, 'destroyBackup'])->where('file', '[A-Za-z0-9._-]+\.zip')->name('system.backups.destroy');
        Route::post('system/backups/{file}/restore', [SystemController::class, 'restore'])->where('file', '[A-Za-z0-9._-]+\.zip')->middleware('throttle:db-restore')->name('system.backups.restore');
        Route::post('system/seeders', [SystemController::class, 'runSeeder'])->middleware('throttle:db-reset')->name('system.seeders.run');
        Route::post('system/database/reset', [SystemController::class, 'reset'])->middleware('throttle:db-reset')->name('system.database.reset');

        Route::get('settings', [SettingsController::class, 'index'])->name('settings');
        Route::put('settings', [SettingsController::class, 'update'])->name('settings.update');
    });
});

Route::get('/run-queue', function () {
    Artisan::call('queue:work --once');

    return 'Queue triggered';
});

require __DIR__.'/settings.php';
