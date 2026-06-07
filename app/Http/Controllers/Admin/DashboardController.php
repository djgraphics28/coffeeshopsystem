<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $todayOrders = Order::today();

        $revenue = (clone $todayOrders)->whereIn('status', ['completed'])->sum('total');
        $orderCount = (clone $todayOrders)->count();
        $avgOrderValue = $orderCount > 0 ? round($revenue / $orderCount, 2) : 0;

        $ordersByStatus = Order::today()
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $recentOrders = Order::with(['table', 'items'])
            ->today()
            ->latest()
            ->limit(10)
            ->get()
            ->map(fn ($o) => [
                'id' => $o->id,
                'order_number' => $o->order_number,
                'status' => $o->status,
                'type' => $o->type,
                'total' => $o->total,
                'table_name' => $o->table?->name ?? 'Walk-in',
                'items_count' => $o->items->count(),
                'created_at' => $o->created_at,
            ]);

        $topItems = OrderItem::select('menu_item_id', DB::raw('SUM(quantity) as total_sold'), DB::raw('SUM(subtotal) as revenue'))
            ->whereHas('order', fn ($q) => $q->today()->where('status', 'completed'))
            ->with('menuItem:id,name')
            ->groupBy('menu_item_id')
            ->orderByDesc('total_sold')
            ->limit(5)
            ->get()
            ->map(fn ($i) => [
                'name' => $i->menuItem?->name,
                'total_sold' => $i->total_sold,
                'revenue' => $i->revenue,
            ]);

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'revenue' => $revenue,
                'order_count' => $orderCount,
                'avg_order_value' => $avgOrderValue,
            ],
            'orders_by_status' => $ordersByStatus,
            'recent_orders' => $recentOrders,
            'top_items' => $topItems,
        ]);
    }
}
