export type PayFrequency = 'daily' | 'half_month' | 'monthly';
export type SalaryType = 'daily' | 'monthly';

export interface Position {
    id: number;
    name: string;
    description: string | null;
    is_driver: boolean;
    system_role: string | null;
    is_active: boolean;
    employees_count?: number;
}

export interface Employee {
    id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    birth_date: string | null;
    hire_date: string | null;
    position_id: number;
    position: { id: number; name: string; is_driver: boolean } | null;
    status: 'active' | 'inactive';
    pay_frequency: PayFrequency;
    salary_type: SalaryType;
    base_salary: number;
    shift_start: string | null;
    shift_end: string | null;
    vehicle: string | null;
    emergency_contact: string | null;
    notes: string | null;
    user: { id: number; email: string } | null;
    has_driver_record: boolean;
}

export const FREQUENCY_LABEL: Record<PayFrequency, string> = {
    daily: 'Daily',
    half_month: 'Half-month (twice a month)',
    monthly: 'Monthly',
};

export const FREQUENCY_SHORT: Record<PayFrequency, string> = { daily: 'Daily', half_month: 'Half-month', monthly: 'Monthly' };

export const money = (currency: string, value: number | string) =>
    `${currency}${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const hoursMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;

export interface PayrollRun {
    id: number;
    reference: string;
    frequency: PayFrequency;
    period_start: string;
    period_end: string;
    label: string;
    status: 'draft' | 'approved' | 'paid';
    pay_date: string | null;
    notes: string | null;
    payslips_count: number | null;
    gross_total: number | null;
    net_total: number | null;
    created_by: string | null;
    approved_at: string | null;
}

export interface PayslipAdjustment { id: number; type: 'earning' | 'deduction'; label: string; amount: number }

export interface PayslipData {
    id: number;
    employee_id: number;
    employee_name: string;
    employee_code: string;
    position: string | null;
    salary_type: SalaryType;
    base_salary: number;
    daily_rate: number;
    hourly_rate: number;
    days_worked: number;
    expected_days: number;
    absent_days: number;
    worked_minutes: number;
    late_minutes: number;
    overtime_minutes: number;
    incomplete_days: number;
    basic_pay: number;
    overtime_pay: number;
    earnings: number;
    late_deduction: number;
    absence_deduction: number;
    other_deductions: number;
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
    adjustments: PayslipAdjustment[];
}

export const STATUS_STYLE: Record<PayrollRun['status'], { label: string; variant: 'warning' | 'info' | 'success' }> = {
    draft: { label: 'Draft', variant: 'warning' },
    approved: { label: 'Approved', variant: 'info' },
    paid: { label: 'Paid', variant: 'success' },
};
