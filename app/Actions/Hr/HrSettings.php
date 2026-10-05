<?php

namespace App\Actions\Hr;

use App\Models\Setting;

/**
 * The human-resource and payroll rules that are set in the system (Payroll → Settings).
 */
class HrSettings
{
    /** @var array<string, string> */
    public const DEFAULTS = [
        'hr_default_pay_frequency' => 'monthly',
        'hr_working_days_per_month' => '26',
        'hr_hours_per_day' => '8',
        'hr_unpaid_break_minutes' => '60',
        'hr_default_shift_start' => '08:00',
        'hr_default_shift_end' => '17:00',
        'hr_late_grace_minutes' => '10',
        'hr_deduct_late' => '1',
        'hr_overtime_enabled' => '1',
        'hr_overtime_multiplier' => '1.25',
        'hr_half_month_cutoff' => '15',
        'hr_attendance_enabled' => '1',
    ];

    public static function get(string $key): string
    {
        return (string) (Setting::get($key) ?? self::DEFAULTS[$key]);
    }

    public static function number(string $key): float
    {
        return (float) self::get($key);
    }

    public static function flag(string $key): bool
    {
        return self::get($key) === '1';
    }

    /**
     * @return array<string, string>
     */
    public static function all(): array
    {
        return collect(self::DEFAULTS)->map(fn (string $default, string $key) => self::get($key))->all();
    }

    /** Writes any missing setting so the defaults show up in the Settings table, never overwriting a saved one. */
    public static function seedDefaults(): void
    {
        foreach (self::DEFAULTS as $key => $value) {
            Setting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
