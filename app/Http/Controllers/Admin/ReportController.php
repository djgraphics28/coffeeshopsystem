<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Reports\ReportBuilder;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    private const PERIODS = ['today', 'week', 'month', 'last_month', 'year', 'custom'];

    /** A custom range is capped so a typo cannot ask for decades of data. */
    private const MAX_RANGE_DAYS = 732;

    public function __construct(private readonly ReportBuilder $reports) {}

    public function index(Request $request): Response|StreamedResponse
    {
        Gate::authorize('view reports');

        $key = in_array($request->query('report'), ReportBuilder::keys(), true) ? $request->query('report') : 'sales-summary';
        [$period, $start, $end] = $this->resolvePeriod($request);

        $report = $this->reports->build($key, $start, $end);

        if ($request->query('export') === 'csv') {
            return $this->csv($report, $start, $end);
        }

        return Inertia::render('Admin/Reports/Index', [
            'catalog' => collect(ReportBuilder::CATALOG)->map(fn (array $items, string $group) => [
                'group' => $group,
                'items' => collect($items)->map(fn (array $meta, string $itemKey) => ['key' => $itemKey, 'title' => $meta['title']])->values(),
            ])->values(),
            'report' => $report,
            'filters' => ['report' => $key, 'period' => $period, 'from' => $start->toDateString(), 'to' => $end->toDateString()],
            'range' => ['label' => $this->rangeLabel($start, $end), 'generated_at' => CarbonImmutable::now()->format('M j, Y g:i A')],
            'currency' => Setting::get('currency', '₱'),
            'cafe_name' => Setting::get('cafe_name', config('app.name')),
        ]);
    }

    /**
     * @return array{0: string, 1: CarbonImmutable, 2: CarbonImmutable}
     */
    private function resolvePeriod(Request $request): array
    {
        $period = in_array($request->query('period'), self::PERIODS, true) ? $request->query('period') : 'month';
        $now = CarbonImmutable::now();

        if ($period === 'custom') {
            try {
                $from = CarbonImmutable::parse((string) $request->query('from'))->startOfDay();
                $to = CarbonImmutable::parse((string) $request->query('to'))->endOfDay();
            } catch (\Throwable) {
                return ['month', $now->startOfMonth(), $now->endOfMonth()];
            }

            if ($from->greaterThan($to)) {
                [$from, $to] = [$to->startOfDay(), $from->endOfDay()];
            }

            if ($from->diffInDays($to) >= self::MAX_RANGE_DAYS) {
                $to = $from->addDays(self::MAX_RANGE_DAYS - 1)->endOfDay();
            }

            return ['custom', $from, $to];
        }

        return match ($period) {
            'today' => ['today', $now->startOfDay(), $now->endOfDay()],
            'week' => ['week', $now->startOfWeek(), $now->endOfWeek()],
            'last_month' => ['last_month', $now->subMonthNoOverflow()->startOfMonth(), $now->subMonthNoOverflow()->endOfMonth()],
            'year' => ['year', $now->startOfYear(), $now->endOfYear()],
            default => ['month', $now->startOfMonth(), $now->endOfMonth()],
        };
    }

    private function rangeLabel(CarbonImmutable $start, CarbonImmutable $end): string
    {
        return $start->isSameDay($end) ? $start->format('M j, Y') : $start->format('M j, Y').' – '.$end->format('M j, Y');
    }

    /**
     * @param  array<string, mixed>  $report
     */
    private function csv(array $report, CarbonImmutable $start, CarbonImmutable $end): StreamedResponse
    {
        $filename = $report['key'].'_'.$start->toDateString().'_to_'.$end->toDateString().'.csv';

        return response()->streamDownload(function () use ($report, $start, $end) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [$report['title'], $this->rangeLabel($start, $end)]);
            fputcsv($out, []);
            fputcsv($out, array_column($report['columns'], 'label'));

            foreach ($report['rows'] as $row) {
                fputcsv($out, array_map(fn (array $col) => $row[$col['key']] ?? '', $report['columns']));
            }

            if ($report['totals']) {
                fputcsv($out, array_map(fn (array $col) => $report['totals'][$col['key']] ?? '', $report['columns']));
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
