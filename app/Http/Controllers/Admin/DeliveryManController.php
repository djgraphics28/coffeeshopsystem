<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DeliveryMan;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryManController extends Controller
{
    public function index(): Response
    {
        $deliveryMen = DeliveryMan::with('user:id,email')->withCount([
            'orders as active_deliveries_count' => fn ($q) => $q->where('type', 'delivery')->whereNotIn('status', ['completed', 'cancelled', 'voided']),
            'orders as total_deliveries_count' => fn ($q) => $q->where('type', 'delivery'),
        ])->orderBy('name')->get();

        return Inertia::render('Admin/DeliveryMen/Index', [
            'delivery_men' => $deliveryMen,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'vehicle' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ]);

        DeliveryMan::create($validated);

        return redirect()->route('admin.delivery-men.index')->with('success', 'Delivery man added.');
    }

    public function update(Request $request, DeliveryMan $deliveryMan): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'vehicle' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ]);

        $deliveryMan->update($validated);

        return redirect()->route('admin.delivery-men.index')->with('success', 'Delivery man updated.');
    }

    public function destroy(DeliveryMan $deliveryMan): RedirectResponse
    {
        // Remove the linked login too so orphaned driver accounts can't sign in
        $deliveryMan->user?->delete();
        $deliveryMan->delete();

        return redirect()->route('admin.delivery-men.index')->with('success', 'Delivery man removed.');
    }

    /**
     * Create (or update) the driver's login account for the driver app.
     */
    public function saveAccount(Request $request, DeliveryMan $deliveryMan): RedirectResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($deliveryMan->user_id)],
            'password' => [$deliveryMan->user ? 'nullable' : 'required', 'string', 'min:8'],
        ]);

        if ($deliveryMan->user) {
            $deliveryMan->user->update(array_filter([
                'email' => $validated['email'],
                'name' => $deliveryMan->name,
                'password' => ! empty($validated['password']) ? Hash::make($validated['password']) : null,
            ]));

            return redirect()->route('admin.delivery-men.index')->with('success', 'Driver account updated.');
        }

        $user = User::create([
            'name' => $deliveryMan->name,
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'email_verified_at' => now(),
        ]);
        $user->assignRole('driver');
        $deliveryMan->update(['user_id' => $user->id]);

        return redirect()->route('admin.delivery-men.index')->with('success', 'Driver account created — they can now sign in to the driver app.');
    }
}
