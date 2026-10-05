import { useForm } from '@inertiajs/react';
import { Bike, KeyRound } from 'lucide-react';
import { useEffect } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { adminHrEmployees, adminHrEmployeesUpdate } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { FREQUENCY_LABEL     } from './types';
import type {Employee, PayFrequency, Position, SalaryType} from './types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: Employee | null;
    positions: Position[];
    roles: string[];
    defaults: { pay_frequency: PayFrequency; shift_start: string; shift_end: string };
    currency: string;
}

interface FormData {
    first_name: string; last_name: string; email: string; phone: string; address: string; birth_date: string; hire_date: string;
    position_id: string; status: 'active' | 'inactive'; pay_frequency: PayFrequency; salary_type: SalaryType; base_salary: string;
    shift_start: string; shift_end: string; vehicle: string; emergency_contact: string; notes: string;
    create_login: boolean; account_email: string; account_password: string; account_role: string;
}

const emptyForm = (defaults: Props['defaults']): FormData => ({
    first_name: '', last_name: '', email: '', phone: '', address: '', birth_date: '', hire_date: new Date().toISOString().slice(0, 10),
    position_id: '', status: 'active', pay_frequency: defaults.pay_frequency, salary_type: 'monthly', base_salary: '',
    shift_start: '', shift_end: '', vehicle: '', emergency_contact: '', notes: '',
    create_login: false, account_email: '', account_password: '', account_role: '',
});

const optionCard = (selected: boolean) =>
    cn('cursor-pointer rounded-xl border-2 p-3 transition-colors', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40');

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {hint && <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{hint}</p>}
            <div className={hint ? '' : 'mt-3'}>{children}</div>
        </section>
    );
}

export function EmployeeFormDialog({ open, onOpenChange, employee, positions, roles, defaults, currency }: Props) {
    const { data, setData, post, put, processing, errors, reset, clearErrors, transform } = useForm<FormData>(emptyForm(defaults));

    useEffect(() => {
        if (!open) {
 return; 
}

        clearErrors();

        if (employee) {
            setData({
                first_name: employee.first_name, last_name: employee.last_name, email: employee.email ?? '', phone: employee.phone ?? '',
                address: employee.address ?? '', birth_date: employee.birth_date ?? '', hire_date: employee.hire_date ?? '',
                position_id: String(employee.position_id), status: employee.status, pay_frequency: employee.pay_frequency,
                salary_type: employee.salary_type, base_salary: String(employee.base_salary), shift_start: employee.shift_start ?? '',
                shift_end: employee.shift_end ?? '', vehicle: employee.vehicle ?? '', emergency_contact: employee.emergency_contact ?? '',
                notes: employee.notes ?? '', create_login: false, account_email: employee.user?.email ?? '', account_password: '', account_role: '',
            });
        } else {
            reset();
            setData(emptyForm(defaults));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, employee?.id]);

    const position = positions.find((p) => String(p.id) === data.position_id);
    const isDriver = !!position?.is_driver;
    const hasLogin = !!employee?.user;
    const err = errors as Record<string, string | undefined>;

    transform((d) => ({ ...d, shift_start: d.shift_start || null, shift_end: d.shift_end || null, birth_date: d.birth_date || null, hire_date: d.hire_date || null, account_role: d.account_role || null }) as never);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => onOpenChange(false) };

        if (employee) {
 put(adminHrEmployeesUpdate(employee.id), options); 
} else {
 post(adminHrEmployees(), options); 
}
    }

    return (
        <CrudModal
            open={open}
            onOpenChange={onOpenChange}
            title={employee ? `Edit ${employee.full_name}` : 'Add employee'}
            description={employee ? employee.employee_code : 'An employee ID (and a QR code for clocking in) is created automatically.'}
            className="max-w-3xl"
            footer={
                <>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" form="employee-form" disabled={processing}>{processing ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}</Button>
                </>
            }
        >
            <form id="employee-form" onSubmit={submit} className="space-y-4">
                <Section title="Personal details">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="First name" required error={err.first_name}><input value={data.first_name} onChange={(e) => setData('first_name', e.target.value)} className={adminFieldClass(!!err.first_name)} autoFocus /></FormField>
                        <FormField label="Last name" required error={err.last_name}><input value={data.last_name} onChange={(e) => setData('last_name', e.target.value)} className={adminFieldClass(!!err.last_name)} /></FormField>
                        <FormField label="Phone" error={err.phone}><input inputMode="tel" value={data.phone} onChange={(e) => setData('phone', e.target.value)} placeholder="0917 123 4567" className={adminFieldClass(!!err.phone)} /></FormField>
                        <FormField label="Contact email" error={err.email}><input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} className={adminFieldClass(!!err.email)} /></FormField>
                        <FormField label="Date of birth" error={err.birth_date}><input type="date" value={data.birth_date} onChange={(e) => setData('birth_date', e.target.value)} className={adminFieldClass(!!err.birth_date)} /></FormField>
                        <FormField label="Date hired" error={err.hire_date}><input type="date" value={data.hire_date} onChange={(e) => setData('hire_date', e.target.value)} className={adminFieldClass(!!err.hire_date)} /></FormField>
                        <FormField label="Address" className="sm:col-span-2" error={err.address}><input value={data.address} onChange={(e) => setData('address', e.target.value)} className={adminFieldClass(!!err.address)} /></FormField>
                        <FormField label="Emergency contact" className="sm:col-span-2" error={err.emergency_contact}><input value={data.emergency_contact} onChange={(e) => setData('emergency_contact', e.target.value)} placeholder="Name and phone number" className={adminFieldClass(!!err.emergency_contact)} /></FormField>
                    </div>
                </Section>

                <Section title="Job" hint="The position decides the system role for a login, and drivers are added to the Delivery Men list automatically.">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Position" required error={err.position_id}>
                            <select value={data.position_id} onChange={(e) => setData('position_id', e.target.value)} className={adminFieldClass(!!err.position_id)}>
                                <option value="">Select a position…</option>
                                {positions.filter((p) => p.is_active || String(p.id) === data.position_id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_driver ? ' (driver)' : ''}</option>)}
                            </select>
                        </FormField>
                        <FormField label="Status" error={err.status}>
                            <select value={data.status} onChange={(e) => setData('status', e.target.value as FormData['status'])} className={adminFieldClass()}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive (no clock-in, no payroll, no sign-in)</option>
                            </select>
                        </FormField>
                        {isDriver && (
                            <FormField label="Vehicle" className="sm:col-span-2" error={err.vehicle} hint="Shown to dispatch, e.g. Honda Click · ABC 1234">
                                <div className="relative"><Bike className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={data.vehicle} onChange={(e) => setData('vehicle', e.target.value)} className={adminFieldClass(!!err.vehicle) + ' pl-9'} /></div>
                            </FormField>
                        )}
                    </div>
                    {isDriver && (
                        <p className="mt-3 rounded-lg bg-info/10 px-3 py-2 text-xs text-foreground">🛵 This employee will also appear in <b>Delivery Men</b> so they can be assigned to deliveries{employee?.has_driver_record ? ' (already linked)' : ''}.</p>
                    )}
                </Section>

                <Section title="Pay" hint="Set how often this employee is paid, and how their rate is quoted. Payroll is worked out from their attendance.">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Paid</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {(['daily', 'half_month', 'monthly'] as const).map((f) => (
                            <label key={f} className={optionCard(data.pay_frequency === f)}>
                                <input type="radio" name="pay_frequency" className="sr-only" checked={data.pay_frequency === f} onChange={() => setData('pay_frequency', f)} />
                                <span className="block text-sm font-semibold text-foreground">{FREQUENCY_LABEL[f].split(' (')[0]}</span>
                                <span className="block text-xs text-muted-foreground">{f === 'daily' ? 'Paid for each day worked' : f === 'half_month' ? 'Twice a month (1st–15th, 16th–end)' : 'Once a month'}</span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <FormField label="Rate is quoted per" error={err.salary_type}>
                            <select value={data.salary_type} onChange={(e) => setData('salary_type', e.target.value as SalaryType)} className={adminFieldClass()}>
                                <option value="monthly">Month (monthly salary)</option>
                                <option value="daily">Day (daily rate)</option>
                            </select>
                        </FormField>
                        <FormField label={data.salary_type === 'daily' ? `Daily rate (${currency})` : `Monthly salary (${currency})`} required error={err.base_salary}>
                            <input type="number" min="0" step="0.01" inputMode="decimal" value={data.base_salary} onChange={(e) => setData('base_salary', e.target.value)} className={adminFieldClass(!!err.base_salary)} />
                        </FormField>
                    </div>
                </Section>

                <Section title="Work schedule" hint={`Used to work out lateness and overtime. Leave empty to use the company default (${defaults.shift_start} – ${defaults.shift_end}).`}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="Shift starts" error={err.shift_start}><input type="time" value={data.shift_start} onChange={(e) => setData('shift_start', e.target.value)} className={adminFieldClass(!!err.shift_start)} /></FormField>
                        <FormField label="Shift ends" error={err.shift_end}><input type="time" value={data.shift_end} onChange={(e) => setData('shift_end', e.target.value)} className={adminFieldClass(!!err.shift_end)} /></FormField>
                    </div>
                </Section>

                <Section title="System sign-in (optional)" hint="Give this employee a login for the POS, Kitchen, Barista or Driver app. Their role comes from their position.">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                        <input type="checkbox" checked={data.create_login} onChange={(e) => setData('create_login', e.target.checked)} className="h-4 w-4 accent-primary" />
                        <KeyRound className="h-4 w-4 text-primary" /> {hasLogin ? 'Update their sign-in account' : 'Create a sign-in account'}
                    </label>
                    {hasLogin && !data.create_login && <p className="mt-2 text-xs text-muted-foreground">Currently signs in as <b className="text-foreground">{employee?.user?.email}</b>.</p>}
                    {data.create_login && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <FormField label="Sign-in email" required error={err.account_email}><input type="email" value={data.account_email} onChange={(e) => setData('account_email', e.target.value)} className={adminFieldClass(!!err.account_email)} autoComplete="off" /></FormField>
                            <FormField label={hasLogin ? 'New password' : 'Password'} required={!hasLogin} error={err.account_password} hint={hasLogin ? 'Leave blank to keep the current password' : 'At least 8 characters'}>
                                <input type="password" value={data.account_password} onChange={(e) => setData('account_password', e.target.value)} className={adminFieldClass(!!err.account_password)} autoComplete="new-password" />
                            </FormField>
                            <FormField label="Role" className="sm:col-span-2" error={err.account_role} hint={position?.system_role ? `Default for ${position.name}: ${position.system_role}` : 'This position has no default role — choose one, or leave empty for no access.'}>
                                <select value={data.account_role} onChange={(e) => setData('account_role', e.target.value)} className={adminFieldClass()}>
                                    <option value="">Use the position's role</option>
                                    {roles.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
                                </select>
                            </FormField>
                        </div>
                    )}
                </Section>

                <FormField label="Notes" error={err.notes}><textarea rows={2} value={data.notes} onChange={(e) => setData('notes', e.target.value)} className={adminFieldClass() + ' resize-none'} /></FormField>
            </form>
        </CrudModal>
    );
}
