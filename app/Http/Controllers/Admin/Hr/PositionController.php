<?php

namespace App\Http\Controllers\Admin\Hr;

use App\Actions\Hr\SyncDriverRecord;
use App\Http\Controllers\Controller;
use App\Models\Position;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

class PositionController extends Controller
{
    /** @var list<array{0: string, 1: string|null, 2: bool}> */
    private const DEFAULTS = [
        ['Manager', null, false], ['Cashier', 'cashier', false], ['Barista', 'barista', false],
        ['Kitchen Staff', 'kitchen', false], ['Server', null, false], ['Driver', 'driver', true], ['Utility', null, false],
    ];

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage employees');

        Position::create($this->validated($request));

        return redirect()->back()->with('success', 'Position added.');
    }

    public function update(Request $request, Position $position, SyncDriverRecord $drivers): RedirectResponse
    {
        Gate::authorize('manage employees');

        $position->update($this->validated($request, $position));

        // Switching the driver flag changes who belongs in the delivery men list.
        $position->employees()->with('position')->get()->each(fn ($employee) => $drivers->handle($employee));

        return redirect()->back()->with('success', 'Position updated.');
    }

    public function destroy(Position $position): RedirectResponse
    {
        Gate::authorize('manage employees');

        if ($position->employees()->exists()) {
            return redirect()->back()->with('error', "\"{$position->name}\" is still assigned to employees. Move them to another position first.");
        }

        $position->delete();

        return redirect()->back()->with('success', 'Position deleted.');
    }

    /** Adds the usual cafe positions that do not exist yet. */
    public function defaults(): RedirectResponse
    {
        Gate::authorize('manage employees');

        $added = 0;

        foreach (self::DEFAULTS as [$name, $role, $isDriver]) {
            $position = Position::firstOrCreate(['name' => $name], ['system_role' => $role, 'is_driver' => $isDriver, 'is_active' => true]);
            $added += $position->wasRecentlyCreated ? 1 : 0;
        }

        return redirect()->back()->with('success', $added > 0 ? "{$added} default position".($added === 1 ? '' : 's').' added.' : 'All default positions already exist.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Position $position = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('positions', 'name')->ignore($position?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_driver' => ['boolean'],
            'system_role' => ['nullable', Rule::in(Role::where('name', '!=', 'admin')->pluck('name')->all())],
            'is_active' => ['boolean'],
        ]);
    }
}
