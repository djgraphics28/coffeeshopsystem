<?php

namespace App\Http\Controllers\Kitchen;

use App\Events\OrderStatusUpdated;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class KitchenController extends Controller
{
    public function index(): Response
    {
        $orders = Order::active()
            ->with(['table', 'items.menuItem', 'items.addons.addon'])
            ->oldest()
            ->get();

        return Inertia::render('Kitchen/KitchenDisplay', [
            'initialOrders' => OrderResource::collection($orders)->resolve(),
        ]);
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(Order::STATUSES)],
        ]);

        $order->update(['status' => $validated['status']]);

        $order->load(['table', 'items.menuItem', 'items.addons.addon']);

        try {
            $fresh = $order->fresh(['table', 'items.menuItem', 'items.addons.addon']);
            if ($fresh) {
                broadcast(new OrderStatusUpdated($fresh))->toOthers();
            }
        } catch (\Throwable $e) {
            Log::warning('Kitchen broadcast failed: '.$e->getMessage());
        }

        return response()->json([
            'order' => (new OrderResource($order))->resolve(),
        ]);
    }
}
