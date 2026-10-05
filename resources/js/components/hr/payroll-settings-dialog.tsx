import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { adminHrPayrollSettings } from '@/lib/routes';
import { FREQUENCY_LABEL  } from './types';
import type {PayFrequency} from './types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: Record<string, string>;
    canManage: boolean;
}

interface FormData {
    hr_default_pay_frequency: PayFrequency; hr_working_days_per_month: string; hr_hours_per_day: string; hr_unpaid_break_minutes: string;
    hr_default_shift_start: string; hr_default_shift_end: string; hr_late_grace_minutes: string; hr_deduct_late: boolean;
    hr_overtime_enabled: boolean; hr_overtime_multiplier: string; hr_half_month_cutoff: string; hr_attendance_enabled: boolean;
}

const fromSettings = (s: Record<string, string>): FormData => ({
    hr_default_pay_frequency: (s.hr_default_pay_frequency as PayFrequency) ?? 'monthly',
    hr_working_days_per_month: s.hr_working_days_per_month ?? '26',
    hr_hours_per_day: s.hr_hours_per_day ?? '8',
    hr_unpaid_break_minutes: s.hr_unpaid_break_minutes ?? '60',
    hr_default_shift_start: s.hr_default_shift_start ?? '08:00',
    hr_default_shift_end: s.hr_default_shift_end ?? '17:00',
    hr_late_grace_minutes: s.hr_late_grace_minutes ?? '10',
    hr_deduct_late: s.hr_deduct_late === '1',
    hr_overtime_enabled: s.hr_overtime_enabled === '1',
    hr_overtime_multiplier: s.hr_overtime_multiplier ?? '1.25',
    hr_half_month_cutoff: s.hr_half_month_cutoff ?? '15',
    hr_attendance_enabled: s.hr_attendance_enabled === '1',
});

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border p-3">
            <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span><span className="block text-sm font-semibold text-foreground">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
        </label>
    );
}

export function PayrollSettingsDialog({ open, onOpenChange, settings, canManage }: Props) {
    const { data, setData, put, processing, errors, clearErrors } = useForm<FormData>(fromSettings(settings));
    const err = errors as Record<string, string | undefined>;

    useEffect(() => {
        if (open) {
 clearErrors(); setData(fromSettings(settings)); 
}
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const field = (key: keyof FormData, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
        <FormField label={label} error={err[key]} hint={hint}>
            <input value={String(data[key])} onChange={(e) => setData(key, e.target.value as never)} disabled={!canManage} className={adminFieldClass(!!err[key])} {...props} />
        </FormField>
    );

    return (
        <CrudModal
            open={open}
            onOpenChange={onOpenChange}
            title="Payroll & attendance settings"
            description="These rules apply to every employee. Changes affect new and recalculated payrolls, not approved ones."
            className="max-w-2xl"
            footer={canManage ? <Button type="submit" form="hr-settings-form" disabled={processing}>{processing ? 'Saving…' : 'Save settings'}</Button> : undefined}
        >
            <form id="hr-settings-form" onSubmit={(e) => {
 e.preventDefault(); put(adminHrPayrollSettings(), { preserveScroll: true, onSuccess: () => onOpenChange(false) }); 
}} className="space-y-5">
                <section>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Pay schedule</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Default for new employees" error={err.hr_default_pay_frequency}>
                            <select value={data.hr_default_pay_frequency} onChange={(e) => setData('hr_default_pay_frequency', e.target.value as PayFrequency)} disabled={!canManage} className={adminFieldClass()}>
                                {(['daily', 'half_month', 'monthly'] as const).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
                            </select>
                        </FormField>
                        {field('hr_half_month_cutoff', 'Half-month cut-off (day)', { type: 'number', min: 1, max: 28 }, 'Pay periods are 1st–this day, then the rest of the month')}
                    </div>
                </section>

                <section>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Working time</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {field('hr_working_days_per_month', 'Working days per month', { type: 'number', min: 1, max: 31, step: '0.5' }, 'Monthly salary ÷ this = daily rate')}
                        {field('hr_hours_per_day', 'Working hours per day', { type: 'number', min: 1, max: 24, step: '0.5' }, 'Daily rate ÷ this = hourly rate')}
                        {field('hr_default_shift_start', 'Default shift starts', { type: 'time' })}
                        {field('hr_default_shift_end', 'Default shift ends', { type: 'time' })}
                        {field('hr_unpaid_break_minutes', 'Unpaid break (minutes)', { type: 'number', min: 0, max: 240 }, 'Taken off days longer than 5 hours')}
                        {field('hr_late_grace_minutes', 'Late grace period (minutes)', { type: 'number', min: 0, max: 120 }, 'Arriving within this is not late')}
                    </div>
                </section>

                <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Pay rules</h3>
                    <Toggle label="Deduct lateness from pay" hint="Late minutes are deducted at the employee's hourly rate." checked={data.hr_deduct_late} onChange={(v) => setData('hr_deduct_late', v)} disabled={!canManage} />
                    <Toggle label="Pay overtime" hint="Time worked after the shift ends is paid at the multiplier below." checked={data.hr_overtime_enabled} onChange={(v) => setData('hr_overtime_enabled', v)} disabled={!canManage} />
                    {data.hr_overtime_enabled && <div className="max-w-xs">{field('hr_overtime_multiplier', 'Overtime multiplier', { type: 'number', min: 1, max: 5, step: '0.05' }, '1.25 = 25% more than the normal rate')}</div>}
                </section>

                <section>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Clock-in screen</h3>
                    <Toggle label="Attendance screen is on" hint="Switch off to stop employees clocking in and out (the screen shows a message instead)." checked={data.hr_attendance_enabled} onChange={(v) => setData('hr_attendance_enabled', v)} disabled={!canManage} />
                </section>
            </form>
        </CrudModal>
    );
}
