<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ExpenseCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseCategoryController extends Controller
{
    public function index(): Response
    {
        Gate::authorize('manage expense categories');

        $categories = ExpenseCategory::withCount('expenses')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/ExpenseCategories/Index', [
            'categories' => $categories,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage expense categories');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:expense_categories,name'],
            'description' => ['nullable', 'string', 'max:255'],
            'color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['boolean'],
        ]);

        ExpenseCategory::create($validated);

        return redirect()->back()->with('success', 'Category created.');
    }

    public function update(Request $request, ExpenseCategory $expenseCategory): RedirectResponse
    {
        Gate::authorize('manage expense categories');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100', 'unique:expense_categories,name,'.$expenseCategory->id],
            'description' => ['nullable', 'string', 'max:255'],
            'color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'is_active' => ['boolean'],
        ]);

        $expenseCategory->update($validated);

        return redirect()->back()->with('success', 'Category updated.');
    }

    public function destroy(ExpenseCategory $expenseCategory): RedirectResponse
    {
        Gate::authorize('manage expense categories');

        if ($expenseCategory->expenses()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete a category that has expenses. Reassign them first.');
        }

        $expenseCategory->delete();

        return redirect()->back()->with('success', 'Category deleted.');
    }
}
