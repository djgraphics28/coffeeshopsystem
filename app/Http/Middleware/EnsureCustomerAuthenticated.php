<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomerAuthenticated
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::guard('customer')->check()) {
            session()->put('customer.intended_url', $request->fullUrl());

            $qrToken = $request->route('qrToken');

            return redirect()->route('customer.auth.login', $qrToken ? ['qrToken' => $qrToken] : []);
        }

        if (! Auth::guard('customer')->user()->hasVerifiedEmail()) {
            return redirect()->route('customer.auth.email.notice');
        }

        return $next($request);
    }
}
