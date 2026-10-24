<?php

namespace App\Http\Controllers\Admin\Cms;

use App\Http\Controllers\Controller;
use App\Support\SiteContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The café's location on the storefront map: address, map pin and Google Maps link.
 */
class LocationController extends Controller
{
    /** @var list<string> */
    public const FIELDS = ['address', 'map_lat', 'map_lng', 'map_url'];

    public function edit(): Response
    {
        return Inertia::render('Admin/Cms/Location', [
            'location' => Arr::only(SiteContent::editable(), self::FIELDS),
            'frontend_url' => config('app.frontend_url'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(Arr::only(SiteContent::rules(), self::FIELDS));

        SiteContent::update($validated, []);

        return redirect()->back()->with('success', 'Location saved.');
    }
}
