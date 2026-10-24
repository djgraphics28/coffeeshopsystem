<?php

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\Cache;

use function Pest\Laravel\getJson;

beforeEach(function () {
    Cache::flush();
    $this->category = Category::factory()->create();
});

/**
 * Record a sale of `$quantity` units of `$item` on an order with the given status / date.
 */
function sell(MenuItem $item, int $quantity, string $status = 'completed', ?string $createdAt = null): void
{
    $order = Order::factory()->create(['status' => $status, 'created_at' => $createdAt ?? now()]);

    OrderItem::create([
        'order_id' => $order->id,
        'menu_item_id' => $item->id,
        'quantity' => $quantity,
        'unit_price' => $item->price,
        'subtotal' => $item->price * $quantity,
    ]);
}

describe('Best sellers API', function () {
    it('ranks items by quantity sold this month', function () {
        $latte = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Latte']);
        $mocha = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Mocha']);
        sell($latte, 3);
        sell($mocha, 5);
        sell($latte, 4);

        getJson(route('api.v1.best-sellers', ['limit' => 2]))
            ->assertOk()
            ->assertJsonPath('data.0.menu_item.name', 'Latte')
            ->assertJsonPath('data.0.sold', 7)
            ->assertJsonPath('data.0.rank', 1)
            ->assertJsonPath('data.0.period', 'month')
            ->assertJsonPath('data.1.menu_item.name', 'Mocha');
    });

    it('ignores cancelled and voided orders', function () {
        $latte = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Latte']);
        $mocha = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Mocha']);
        sell($latte, 2);
        sell($mocha, 9, 'cancelled');
        sell($mocha, 9, 'voided');

        getJson(route('api.v1.best-sellers', ['limit' => 1]))
            ->assertOk()
            ->assertJsonPath('data.0.menu_item.name', 'Latte');
    });

    it('leaves out items that are no longer available', function () {
        $soldOut = MenuItem::factory()->create(['category_id' => $this->category->id, 'is_available' => false]);
        $latte = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Latte']);
        sell($soldOut, 50);
        sell($latte, 1);

        getJson(route('api.v1.best-sellers'))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.menu_item.name', 'Latte');
    });

    it('falls back to all-time sales when this month is too quiet', function () {
        $latte = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Latte']);
        $classic = MenuItem::factory()->create(['category_id' => $this->category->id, 'name' => 'Classic']);
        sell($latte, 1);
        sell($classic, 20, 'completed', now()->subMonths(3)->toDateTimeString());

        getJson(route('api.v1.best-sellers', ['limit' => 2]))
            ->assertOk()
            ->assertJsonPath('data.0.menu_item.name', 'Classic')
            ->assertJsonPath('data.0.period', 'all-time')
            ->assertJsonCount(2, 'data');
    });

    it('returns an empty list before anything has sold', function () {
        getJson(route('api.v1.best-sellers'))->assertOk()->assertJsonCount(0, 'data');
    });
});
