<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\MenuItemResource;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Setting;
use App\Models\Table;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StorefrontController extends Controller
{
    public function show(Request $request, string $qrToken): Response
    {
        $table = Table::where('qr_token', $qrToken)->where('is_active', true)->firstOrFail();

        $request->session()->put('storefront_qr_scan', [
            'table_id' => $table->id,
            'scanned_at' => now()->timestamp,
        ]);

        $categories = Category::active()
            ->with(['availableMenuItems.variations', 'availableMenuItems.addonGroups.addons'])
            ->get();

        $featuredItems = MenuItem::available()
            ->featured()
            ->with(['category', 'variations', 'addonGroups.addons'])
            ->orderBy('sort_order')
            ->get();

        $settings = Setting::getAll();

        return Inertia::render('Customer/Storefront', [
            'table' => [
                'id' => $table->id,
                'name' => $table->name,
                'qr_token' => $table->qr_token,
            ],
            'categories' => CategoryResource::collection($categories)->resolve(),
            'featured_items' => MenuItemResource::collection($featuredItems)->resolve(),
            'settings' => [
                'cafe_name' => $settings['cafe_name'] ?? "Milk&Honey Cafe'",
                'cafe_tagline' => $settings['cafe_tagline'] ?? 'Crafted with love, served with warmth.',
                'currency' => $settings['currency'] ?? '₱',
                'estimated_wait_minutes' => $settings['estimated_wait_minutes'] ?? '10-15',
                'points_earn_rate' => (float) ($settings['points_earn_rate'] ?? 1),
                'points_redeem_rate' => (int) ($settings['points_redeem_rate'] ?? 100),
                'loyalty_cups_enabled' => ($settings['loyalty_cups_enabled'] ?? '0') === '1',
                'loyalty_cups_threshold' => (int) ($settings['loyalty_cups_threshold'] ?? 10),
            ],
        ]);
    }
}
