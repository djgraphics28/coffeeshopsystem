<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Menu\BestSellers;
use App\Http\Controllers\Controller;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\MenuItemResource;
use App\Models\Category;
use App\Models\Customer;
use App\Models\MenuItem;
use App\Models\Setting;
use App\Models\Table;
use App\Rules\Recaptcha;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class StorefrontController extends Controller
{
    /**
     * Cafe details, pricing rules and payment instructions the ordering frontend needs.
     */
    public function settings(): JsonResponse
    {
        $settings = Setting::getAll();

        return response()->json([
            'data' => [
                'cafe_name' => $settings['cafe_name'] ?? "Milk&Honey Cafe'",
                'cafe_tagline' => $settings['cafe_tagline'] ?? 'Crafted with love, served with warmth.',
                'currency' => $settings['currency'] ?? '₱',
                'tax_rate' => (float) ($settings['tax_rate'] ?? 12),
                'estimated_wait_minutes' => $settings['estimated_wait_minutes'] ?? '10-15',
                'points_earn_rate' => (float) ($settings['points_earn_rate'] ?? 1),
                'points_redeem_rate' => (int) ($settings['points_redeem_rate'] ?? 100),
                'loyalty_cups_enabled' => ($settings['loyalty_cups_enabled'] ?? '0') === '1',
                'loyalty_cups_threshold' => (int) ($settings['loyalty_cups_threshold'] ?? 10),
                'delivery_fee' => (float) ($settings['delivery_fee'] ?? 0),
                'free_delivery_minimum' => (float) ($settings['free_delivery_minimum'] ?? 0),
                'gcash_number' => $settings['gcash_number'] ?? null,
                'gcash_account_name' => $settings['gcash_account_name'] ?? null,
                'gcash_qr_url' => ! empty($settings['gcash_qr_path']) ? Storage::disk('public')->url($settings['gcash_qr_path']) : null,
                'maya_number' => $settings['maya_number'] ?? null,
                'maya_account_name' => $settings['maya_account_name'] ?? null,
                'maya_qr_url' => ! empty($settings['maya_qr_path']) ? Storage::disk('public')->url($settings['maya_qr_path']) : null,
                'recaptcha_site_key' => Recaptcha::isConfigured() ? config('services.recaptcha.site_key') : null,
                'email_verification_required' => Customer::emailVerificationRequired(),
            ],
        ]);
    }

    /**
     * Active categories with their available items, plus the featured picks.
     */
    public function menu(): JsonResponse
    {
        $categories = Category::active()
            ->with(['availableMenuItems.variations', 'availableMenuItems.addonGroups.addons'])
            ->get();

        $featuredItems = MenuItem::available()
            ->featured()
            ->with(['category', 'variations', 'addonGroups.addons'])
            ->orderBy('sort_order')
            ->get();

        return response()->json([
            'data' => [
                'categories' => CategoryResource::collection($categories)->resolve(),
                'featured_items' => MenuItemResource::collection($featuredItems)->resolve(),
            ],
        ]);
    }

    /**
     * Top-selling menu items, ranked by quantity sold (see BestSellers for the rules).
     */
    public function bestSellers(Request $request, BestSellers $bestSellers): JsonResponse
    {
        $limit = min(max($request->integer('limit', 6), 1), 12);

        return response()->json([
            'data' => $bestSellers->handle($limit)->map(fn (array $entry, int $index) => [
                'rank' => $index + 1,
                'sold' => $entry['sold'],
                'period' => $entry['period'],
                'menu_item' => (new MenuItemResource($entry['menu_item']))->resolve(),
            ]),
        ]);
    }

    /**
     * Resolve a scanned table QR code so the frontend can switch to dine-in mode.
     */
    public function table(string $qrToken): JsonResponse
    {
        $table = Table::where('qr_token', $qrToken)->where('is_active', true)->firstOrFail();

        return response()->json([
            'data' => [
                'id' => $table->id,
                'name' => $table->name,
                'qr_token' => $table->qr_token,
            ],
        ]);
    }
}
