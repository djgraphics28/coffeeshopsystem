<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Handles the signed link from the customer verification email, then sends the
 * customer back to the ordering frontend with the outcome.
 */
class VerifyEmailController extends Controller
{
    public function __invoke(Request $request, int $id, string $hash): RedirectResponse
    {
        $frontendUrl = rtrim(config('app.frontend_url'), '/');
        $customer = Customer::find($id);

        if (! $request->hasValidSignature() || ! $customer || ! hash_equals($hash, sha1($customer->getEmailForVerification()))) {
            return redirect()->away("{$frontendUrl}/verify-email?status=invalid");
        }

        if (! $customer->hasVerifiedEmail()) {
            $customer->markEmailAsVerified();
        }

        return redirect()->away("{$frontendUrl}/verify-email?status=verified");
    }
}
