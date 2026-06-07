<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Table;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TableController extends Controller
{
    public function index(): Response
    {
        $tables = Table::orderBy('sort_order')->get();

        return Inertia::render('Admin/Tables/Index', [
            'tables' => $tables,
            'base_url' => config('app.url'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        Table::create($validated);

        return redirect()->route('admin.tables.index')->with('success', 'Table created.');
    }

    public function update(Request $request, Table $table): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $table->update($validated);

        return redirect()->route('admin.tables.index')->with('success', 'Table updated.');
    }

    public function destroy(Table $table): RedirectResponse
    {
        $table->delete();

        return redirect()->route('admin.tables.index')->with('success', 'Table deleted.');
    }

    public function regenerateQr(Table $table): RedirectResponse
    {
        $table->update(['qr_token' => \Illuminate\Support\Str::uuid()->toString()]);

        return redirect()->route('admin.tables.index')->with('success', 'QR code regenerated.');
    }
}
