<?php

use App\Actions\Reports\ReportBuilder;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\User;

use function Pest\Laravel\actingAs;

beforeEach(function () {
    $this->admin = User::factory()->create();
    $this->admin->assignRole('admin');
});

it('shows every report to an admin without errors', function (string $key) {
    $order = Order::factory()->completed()->create(['total' => 200, 'subtotal' => 178.57, 'discount' => 10]);
    OrderItem::create(['order_id' => $order->id, 'menu_item_id' => MenuItem::factory()->create()->id, 'quantity' => 2, 'unit_price' => 100, 'subtotal' => 200]);
    Payment::create(['order_id' => $order->id, 'amount' => 500, 'method' => 'cash', 'paid_at' => now()]);
    Expense::create(['expense_category_id' => ExpenseCategory::create(['name' => 'Supplies'])->id, 'title' => 'Milk', 'amount' => 50, 'expense_date' => today()]);

    actingAs($this->admin)
        ->get(route('admin.reports', ['report' => $key, 'period' => 'today']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Admin/Reports/Index')->where('report.key', $key)->has('report.columns'));
})->with(fn () => ReportBuilder::keys());

it('adds up completed sales per item and ignores cancelled orders', function () {
    $item = MenuItem::factory()->create(['name' => 'Latte']);
    $done = Order::factory()->completed()->create(['total' => 200]);
    $cancelled = Order::factory()->create(['status' => 'cancelled', 'total' => 999]);

    foreach ([$done, $cancelled] as $order) {
        OrderItem::create(['order_id' => $order->id, 'menu_item_id' => $item->id, 'quantity' => 2, 'unit_price' => 100, 'subtotal' => 200]);
    }

    actingAs($this->admin)
        ->get(route('admin.reports', ['report' => 'sales-by-item', 'period' => 'today']))
        ->assertInertia(fn ($page) => $page->where('report.rows.0.item', 'Latte')->where('report.rows.0.quantity', 2)->where('report.rows.0.sales', 200));
});

it('exports a report as csv', function () {
    actingAs($this->admin)
        ->get(route('admin.reports', ['report' => 'expense-summary', 'period' => 'today', 'export' => 'csv']))
        ->assertOk()
        ->assertDownload();
});

it('keeps reports away from users without the permission', function () {
    $cashier = User::factory()->create();
    $cashier->assignRole('cashier');

    actingAs($cashier)->get(route('admin.reports'))->assertForbidden();
});
