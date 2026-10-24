<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CustomerProfileResource;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function update(Request $request): CustomerProfileResource
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $request->user()->update($validated);

        return new CustomerProfileResource($request->user()->fresh());
    }
}
