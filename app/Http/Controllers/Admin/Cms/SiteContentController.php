<?php

namespace App\Http\Controllers\Admin\Cms;

use App\Http\Controllers\Controller;
use App\Support\SiteContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SiteContentController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Admin/Cms/SiteContent', [
            'content' => SiteContent::editable(),
            'defaults' => SiteContent::DEFAULTS,
            'frontend_url' => config('app.frontend_url'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate(SiteContent::rules());

        SiteContent::update($validated, [
            'hero_image' => $request->file('hero_image'),
            'about_image' => $request->file('about_image'),
        ]);

        return redirect()->back()->with('success', 'Website content saved.');
    }
}
