<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ExpenseController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('view expenses');

        $query = Expense::with('category', 'user')
            ->latest('expense_date')
            ->latest('id');

        if ($request->filled('category_id')) {
            $query->where('expense_category_id', $request->category_id);
        }

        if ($request->filled('from')) {
            $query->whereDate('expense_date', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('expense_date', '<=', $request->to);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->search.'%');
        }

        $expenses = $query->get();

        $settings = Setting::getAll();

        $stats = [
            'total' => $expenses->count(),
            'total_amount' => $expenses->sum('amount'),
            'this_month' => $expenses->filter(fn ($e) => $e->expense_date->isCurrentMonth())->sum('amount'),
            'this_week' => $expenses->filter(fn ($e) => $e->expense_date->isCurrentWeek())->sum('amount'),
        ];

        $categories = ExpenseCategory::active()->get(['id', 'name', 'color']);

        return Inertia::render('Admin/Expenses/Index', [
            'expenses' => $expenses->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'amount' => $e->amount,
                'expense_date' => $e->expense_date->toDateString(),
                'notes' => $e->notes,
                'reference_no' => $e->reference_no,
                'category' => $e->category ? ['id' => $e->category->id, 'name' => $e->category->name, 'color' => $e->category->color] : null,
                'user' => $e->user ? ['name' => $e->user->name] : null,
                'created_at' => $e->created_at,
            ])->values(),
            'categories' => $categories,
            'stats' => $stats,
            'filters' => $request->only(['category_id', 'from', 'to', 'search']),
            'settings' => [
                'currency' => $settings['currency'] ?? '₱',
            ],
            'can' => [
                'manage_expenses' => Auth::user()?->can('manage expenses') ?? false,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manage expenses');

        $validated = $request->validate([
            'expense_category_id' => ['required', 'exists:expense_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'reference_no' => ['nullable', 'string', 'max:100'],
        ]);

        $validated['user_id'] = Auth::id();

        Expense::create($validated);

        return redirect()->back()->with('success', 'Expense recorded.');
    }

    public function update(Request $request, Expense $expense): RedirectResponse
    {
        Gate::authorize('manage expenses');

        $validated = $request->validate([
            'expense_category_id' => ['required', 'exists:expense_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'expense_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'reference_no' => ['nullable', 'string', 'max:100'],
        ]);

        $expense->update($validated);

        return redirect()->back()->with('success', 'Expense updated.');
    }

    public function destroy(Expense $expense): RedirectResponse
    {
        Gate::authorize('manage expenses');

        $expense->delete();

        return redirect()->back()->with('success', 'Expense deleted.');
    }
}
