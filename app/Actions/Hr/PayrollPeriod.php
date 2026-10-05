<?php

namespace App\Actions\Hr;

use Carbon\CarbonImmutable;
use InvalidArgumentException;

/**
 * Turns "daily / half month / monthly" plus a date into the exact pay period and a readable name for it.
 */
class PayrollPeriod
{
    /**
     * @param  string  $frequency  daily | half_month | monthly
     * @param  string  $anchor  a date (daily) or a month "YYYY-MM" (half_month, monthly)
     * @param  int|null  $half  1 or 2, for half_month only
     * @return array{start: CarbonImmutable, end: CarbonImmutable, label: string, reference: string}
     */
    public static function resolve(string $frequency, string $anchor, ?int $half = null): array
    {
        if ($frequency === 'daily') {
            $day = CarbonImmutable::parse($anchor)->startOfDay();

            return [
                'start' => $day,
                'end' => $day->endOfDay(),
                'label' => $day->format('D, M j, Y'),
                'reference' => 'PR-D-'.$day->format('Ymd'),
            ];
        }

        $month = CarbonImmutable::createFromFormat('!Y-m', substr($anchor, 0, 7));

        if ($frequency === 'monthly') {
            return [
                'start' => $month->startOfMonth(),
                'end' => $month->endOfMonth(),
                'label' => $month->format('F Y'),
                'reference' => 'PR-M-'.$month->format('Ym'),
            ];
        }

        if ($frequency !== 'half_month' || ! in_array($half, [1, 2], true)) {
            throw new InvalidArgumentException('Choose which half of the month to pay (1st or 2nd).');
        }

        $cutoff = max(1, min(28, (int) HrSettings::number('hr_half_month_cutoff')));
        $start = $half === 1 ? $month->startOfMonth() : $month->startOfMonth()->addDays($cutoff);
        $end = $half === 1 ? $month->startOfMonth()->addDays($cutoff - 1)->endOfDay() : $month->endOfMonth();

        return [
            'start' => $start,
            'end' => $end,
            'label' => $start->format('M j').' – '.$end->format('M j, Y'),
            'reference' => 'PR-H-'.$month->format('Ym').'-'.$half,
        ];
    }
}
