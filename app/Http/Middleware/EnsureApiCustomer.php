<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the customer ordering API: the Sanctum token must belong to a
 * customer, and with `verified` the customer's email must be confirmed
 * (unless the admin turned email verification off).
 */
class EnsureApiCustomer
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, ?string $requirement = null): Response
    {
        $customer = $request->user();

        if (! $customer instanceof Customer) {
            return response()->json([
                'message' => 'Please sign in or create an account to continue.',
                'requires_auth' => true,
            ], 401);
        }

        if ($requirement === 'verified' && Customer::emailVerificationRequired() && ! $customer->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before placing an order.',
                'requires_verification' => true,
            ], 403);
        }

        return $next($request);
    }
}
