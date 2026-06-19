<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user->hasRole('admin') || $user->can('access admin')) {
            return redirect()->route('admin.dashboard');
        }

        if ($user->hasRole('cashier') || $user->can('access pos')) {
            return redirect()->route('pos.index');
        }

        if ($user->hasRole('kitchen') || $user->can('access kitchen')) {
            return redirect()->route('kitchen.index');
        }

        return redirect()->route('login');
    }
}
