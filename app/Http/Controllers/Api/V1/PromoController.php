<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Promo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PromoController extends Controller
{
    /**
     * Check a promo code against the cart subtotal before checkout.
     */
    public function apply(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'order_subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $promo = Promo::where('code', strtoupper(trim($validated['code'])))->first();

        if (! $promo) {
            return response()->json(['valid' => false, 'message' => 'Promo code not found.']);
        }

        $customerId = $request->user()->id;
        $subtotal = (float) $validated['order_subtotal'];

        if (! $promo->isValid($subtotal, $customerId)) {
            return response()->json(['valid' => false, 'message' => $promo->invalidReason($subtotal, $customerId)]);
        }

        return response()->json([
            'valid' => true,
            'message' => "Promo applied: {$promo->name}",
            'discount_amount' => $promo->calculateDiscount($subtotal),
            'promo' => [
                'id' => $promo->id,
                'code' => $promo->code,
                'name' => $promo->name,
                'type' => $promo->type,
                'value' => $promo->value,
            ],
        ]);
    }
}
