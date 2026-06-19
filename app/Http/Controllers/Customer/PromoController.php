<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Promo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PromoController extends Controller
{
    public function apply(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string'],
            'order_subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $promo = Promo::where('code', strtoupper(trim($request->string('code'))))->first();

        if (! $promo) {
            return response()->json(['valid' => false, 'message' => 'Promo code not found.']);
        }

        $customerId = Auth::guard('customer')->id();
        $subtotal = (float) $request->input('order_subtotal');

        if (! $promo->isValid($subtotal, $customerId)) {
            return response()->json(['valid' => false, 'message' => $promo->invalidReason($subtotal, $customerId)]);
        }

        $discount = $promo->calculateDiscount($subtotal);

        return response()->json([
            'valid' => true,
            'message' => "Promo applied: {$promo->name}",
            'discount_amount' => $discount,
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
