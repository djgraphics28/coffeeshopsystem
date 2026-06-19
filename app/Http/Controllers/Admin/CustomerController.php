<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(): Response
    {
        $customers = Customer::withCount('orders')
            ->withSum('orders', 'total')
            ->withSum('orders', 'points_earned')
            ->with(['orders' => fn ($q) => $q->latest()->limit(1)])
            ->latest()
            ->get();

        $stats = [
            'total' => $customers->count(),
            'total_points_outstanding' => $customers->sum('points'),
            'loyalty_members' => $customers->where('cup_count', '>', 0)->count(),
            'free_drinks_available' => $customers->sum('free_drinks_available'),
        ];

        return Inertia::render('Admin/Customers/Index', [
            'customers' => CustomerResource::collection($customers)->resolve(),
            'stats' => $stats,
        ]);
    }

    public function show(Customer $customer): Response
    {
        $customer->load([
            'orders' => fn ($q) => $q->with(['table', 'payment', 'promo'])
                ->withCount('items')
                ->latest(),
        ]);

        $settings = Setting::getAll();

        $summary = [
            'total_orders' => $customer->orders->count(),
            'total_spent' => $customer->orders->sum('total'),
            'total_discount' => $customer->orders->sum('discount'),
            'lifetime_points_earned' => $customer->orders->sum('points_earned'),
            'total_cups_awarded' => $customer->orders->sum('cups_awarded'),
            'free_drinks_redeemed' => $customer->orders->where('free_drink_redeemed', true)->count(),
            'first_order_at' => $customer->orders->last()?->created_at,
            'last_order_at' => $customer->orders->first()?->created_at,
        ];

        return Inertia::render('Admin/Customers/Show', [
            'customer' => (new CustomerResource($customer))->resolve(),
            'orders' => $customer->orders->map(fn ($order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'type' => $order->type,
                'subtotal' => $order->subtotal,
                'discount' => $order->discount,
                'tax' => $order->tax,
                'total' => $order->total,
                'points_earned' => $order->points_earned,
                'points_redeemed' => $order->points_redeemed,
                'free_drink_redeemed' => $order->free_drink_redeemed,
                'cups_awarded' => $order->cups_awarded,
                'items_count' => $order->items_count,
                'table_name' => $order->table?->name,
                'promo_code' => $order->promo?->code,
                'payment_method' => $order->payment?->method,
                'created_at' => $order->created_at,
            ])->values(),
            'summary' => $summary,
            'settings' => [
                'currency' => $settings['currency'] ?? '₱',
                'loyalty_cups_threshold' => (int) ($settings['loyalty_cups_threshold'] ?? 10),
                'loyalty_cups_enabled' => ($settings['loyalty_cups_enabled'] ?? '0') === '1',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:customers,phone'],
            'email' => ['nullable', 'email', 'unique:customers,email'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        Customer::create($validated);

        return redirect()->route('admin.customers.index')->with('success', 'Customer created.');
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:customers,phone,'.$customer->id],
            'email' => ['nullable', 'email', 'unique:customers,email,'.$customer->id],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $customer->update($validated);

        return redirect()->back()->with('success', 'Customer updated.');
    }

    public function adjustLoyalty(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'points' => ['required', 'integer', 'min:0'],
            'cup_count' => ['required', 'integer', 'min:0', 'max:999'],
            'free_drinks_available' => ['required', 'integer', 'min:0', 'max:99'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $customer->update([
            'points' => $validated['points'],
            'cup_count' => $validated['cup_count'],
            'free_drinks_available' => $validated['free_drinks_available'],
        ]);

        return redirect()->back()->with('success', 'Loyalty data updated.');
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        $customer->delete();

        return redirect()->route('admin.customers.index')->with('success', 'Customer deleted.');
    }
}
