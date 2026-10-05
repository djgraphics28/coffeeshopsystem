<?php

namespace App\Http\Controllers\Kitchen;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Display boards for the preparation stations. The kitchen cooks the items flagged `is_kitchen`;
 * the barista makes everything else. Both boards work the same way, keyed by the `station` route default.
 */
class StationController extends Controller
{
    private const RELATIONS = ['table', 'items.menuItem', 'items.addons.addon'];

    public function index(string $station): Response
    {
        $orders = Order::active()
            ->with(self::RELATIONS)
            ->oldest()
            ->get()
            ->filter(fn (Order $order) => in_array($order->stationStatus($station), ['pending', 'preparing', 'ready'], true));

        return Inertia::render('Kitchen/KitchenDisplay', [
            'station' => $station,
            'initialOrders' => $orders
                ->map(fn (Order $order) => $this->forStation((new OrderResource($order))->resolve(), $station))
                ->values(),
        ]);
    }

    public function updateStatus(Request $request, Order $order, string $station): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(Order::STATION_STATUSES)],
        ]);

        if ($rejection = $this->rejectIfNotWorkable($order, $station)) {
            return $rejection;
        }

        $order->setStationStatus($station, $validated['status']);

        return $this->respond($order, $station);
    }

    /**
     * Mark a single item as done (or undo it).
     */
    public function toggleItem(Request $request, OrderItem $orderItem, string $station): JsonResponse
    {
        $validated = $request->validate(['done' => ['required', 'boolean']]);

        $order = $orderItem->order;

        if ($rejection = $this->rejectIfNotWorkable($order, $station)) {
            return $rejection;
        }

        if (! $order->stationItems($station)->contains('id', $orderItem->id)) {
            return response()->json(['message' => 'This item is not prepared at this station.'], 422);
        }

        $orderItem->update(['prepared_at' => $validated['done'] ? now() : null]);

        return $this->itemsUpdated($order, $station, (bool) $validated['done']);
    }

    /**
     * Mark every item of this station as done (or clear them all).
     */
    public function checkAll(Request $request, Order $order, string $station): JsonResponse
    {
        $validated = $request->validate(['done' => ['nullable', 'boolean']]);
        $done = $validated['done'] ?? true;

        if ($rejection = $this->rejectIfNotWorkable($order, $station)) {
            return $rejection;
        }

        $order->items()
            ->whereIn('id', $order->stationItems($station)->pluck('id'))
            ->when($done, fn ($items) => $items->whereNull('prepared_at'))
            ->update(['prepared_at' => $done ? now() : null]);

        return $this->itemsUpdated($order, $station, $done);
    }

    /**
     * Starting to tick items off means the station has started the order, so a new one moves to "preparing".
     */
    private function itemsUpdated(Order $order, string $station, bool $done): JsonResponse
    {
        $order->refresh();

        if ($done && $order->stationStatus($station) === 'pending') {
            $order->setStationStatus($station, 'preparing');
        }

        return $this->respond($order, $station);
    }

    private function rejectIfNotWorkable(Order $order, string $station): ?JsonResponse
    {
        if (! $order->isVoidable()) {
            return response()->json(['message' => "This order is already {$order->status}."], 422);
        }

        if ($order->stationItems($station)->isEmpty()) {
            return response()->json(['message' => 'This order has no items for this station.'], 422);
        }

        return null;
    }

    private function respond(Order $order, string $station): JsonResponse
    {
        $order = $order->fresh(self::RELATIONS);

        try {
            broadcast(new OrderStatusUpdated($order))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('Station broadcast failed: '.$e->getMessage());
        }

        return response()->json([
            'order' => $this->forStation((new OrderResource($order))->resolve(), $station),
        ]);
    }

    /**
     * A station only sees the items it has to prepare.
     *
     * @param  array<string, mixed>  $order
     * @return array<string, mixed>
     */
    private function forStation(array $order, string $station): array
    {
        $order['items'] = collect($order['items'] ?? [])
            ->filter(fn ($item) => (bool) ($item['menu_item']['is_kitchen'] ?? true) === ($station === 'kitchen'))
            ->values();

        return $order;
    }
}
