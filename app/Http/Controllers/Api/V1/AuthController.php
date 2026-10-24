<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CustomerProfileResource;
use App\Models\Customer;
use App\Rules\Recaptcha;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'device_name' => ['nullable', 'string', 'max:100'],
            'recaptcha_token' => [
                Rule::requiredIf(Recaptcha::isConfigured()),
                'nullable',
                'string',
                new Recaptcha,
            ],
        ], [
            'recaptcha_token.required' => 'CAPTCHA verification failed. Please refresh the page and try again.',
        ]);

        $customer = Customer::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
        ]);

        if (Customer::emailVerificationRequired()) {
            $customer->sendEmailVerificationNotification();
        } else {
            $customer->markEmailAsVerified();
        }

        return $this->tokenResponse($customer, $validated['device_name'] ?? null, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:100'],
        ]);

        $customer = Customer::where('email', $validated['email'])->first();

        if (! $customer || ! Hash::check($validated['password'], $customer->password)) {
            throw ValidationException::withMessages(['email' => ['Invalid email or password.']]);
        }

        return $this->tokenResponse($customer, $validated['device_name'] ?? null);
    }

    public function me(Request $request): CustomerProfileResource
    {
        return new CustomerProfileResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out.']);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        if ($customer->hasVerifiedEmail()) {
            return response()->json(['message' => 'Your email is already verified.']);
        }

        $customer->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification email resent! Check your inbox.']);
    }

    protected function tokenResponse(Customer $customer, ?string $deviceName, int $status = 200): JsonResponse
    {
        $token = $customer->createToken($deviceName ?: 'ordering-frontend')->plainTextToken;

        return response()->json([
            'token' => $token,
            'customer' => (new CustomerProfileResource($customer->fresh()))->resolve(),
        ], $status);
    }
}
