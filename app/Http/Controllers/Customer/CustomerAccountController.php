<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAccountController extends Controller
{
    public function orders(): Response
    {
        $customer = Auth::guard('customer')->user();

        $orders = Order::query()
            ->where('customer_id', $customer->id)
            ->with(['table', 'items.menuItem', 'items.addons.addon'])
            ->latest()
            ->paginate(10);

        return Inertia::render('Customer/OrderHistory', [
            'orders' => OrderResource::collection($orders->items())->resolve(),
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
            'settings' => [
                'cafe_name' => Setting::get('cafe_name', "Milk&Honey Cafe'"),
                'currency' => Setting::get('currency', '₱'),
            ],
        ]);
    }

    public function profile(): Response
    {
        $customer = Auth::guard('customer')->user();

        return Inertia::render('Customer/Profile', [
            'stats' => [
                'total_orders' => Order::where('customer_id', $customer->id)->count(),
                'total_spent' => (float) Order::where('customer_id', $customer->id)
                    ->whereNotIn('status', ['cancelled', 'voided'])
                    ->sum('total'),
            ],
            'phone' => $customer->phone,
            'settings' => [
                'cafe_name' => Setting::get('cafe_name', "Milk&Honey Cafe'"),
                'currency' => Setting::get('currency', '₱'),
                'loyalty_cups_enabled' => Setting::get('loyalty_cups_enabled', '0') === '1',
                'loyalty_cups_threshold' => (int) Setting::get('loyalty_cups_threshold', 10),
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        Auth::guard('customer')->user()->update($validated);

        return redirect()->back()->with('success', 'Profile updated!');
    }
}
