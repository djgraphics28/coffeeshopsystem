<?php

namespace App\Http\Middleware;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user('web') ? [
                    'id' => $request->user('web')->id,
                    'name' => $request->user('web')->name,
                    'email' => $request->user('web')->email,
                    'roles' => $request->user('web')->getRoleNames(),
                    'permissions' => $request->user('web')->getAllPermissions()->pluck('name'),
                ] : null,
            ],
            'customer_auth' => [
                'customer' => fn () => Auth::guard('customer')->user() ? [
                    'id' => Auth::guard('customer')->user()->id,
                    'name' => Auth::guard('customer')->user()->name,
                    'email' => Auth::guard('customer')->user()->email,
                    'points' => Auth::guard('customer')->user()->points,
                    'cup_count' => Auth::guard('customer')->user()->cup_count,
                    'free_drinks_available' => Auth::guard('customer')->user()->free_drinks_available,
                ] : null,
                'active_order' => function () {
                    $customer = Auth::guard('customer')->user();

                    if (! $customer) {
                        return null;
                    }

                    return Order::query()
                        ->where('customer_id', $customer->id)
                        ->active()
                        ->latest()
                        ->first(['id', 'order_number', 'status'])
                        ?->only(['id', 'order_number', 'status']);
                },
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
