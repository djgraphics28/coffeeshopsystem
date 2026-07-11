import { Head, useForm, usePage } from '@inertiajs/react';
import { customerAuthLogout, customerMyProfileUpdate } from '@/lib/routes';
import { LogOut } from 'lucide-react';
import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import CustomerNav from '@/components/CustomerNav';

/* Retro-geometric palette shared with the storefront */
const P = {
    cream: '#E4DACB',
    creamLight: '#EFE8DC',
    navy: '#232B4A',
    terracotta: '#C05B2D',
    caramel: '#B5824F',
    espresso: '#3B2A1D',
    sand: '#D8CBB8',
};

interface Customer {
    id: number;
    name: string;
    email: string;
    points: number;
    cup_count: number;
    free_drinks_available: number;
}

interface Props {
    stats: { total_orders: number; total_spent: number };
    phone: string | null;
    settings: { cafe_name: string; currency: string; loyalty_cups_enabled: boolean; loyalty_cups_threshold: number };
}

export default function Profile({ stats, phone, settings }: Props) {
    const { customer_auth, flash } = usePage().props as unknown as {
        customer_auth: { customer: Customer | null };
        flash?: { success?: string };
    };
    const customer = customer_auth.customer!;

    const { data, setData, put, processing, errors } = useForm({
        name: customer.name,
        phone: phone ?? '',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
    }, [flash]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        put(customerMyProfileUpdate());
    }

    return (
        <div className="customer-page min-h-screen pb-24" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Head title={`My Profile — ${settings.cafe_name}`} />
            <Toaster position="top-center" />

            {/* Header */}
            <div className="px-5 py-8" style={{ background: P.navy }}>
                <div className="mx-auto flex max-w-2xl items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-black text-white" style={{ background: P.terracotta }}>
                        {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <h1 className="truncate text-xl font-black uppercase tracking-tight text-white">{customer.name}</h1>
                        <p className="truncate text-xs" style={{ color: P.cream }}>{customer.email}</p>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Orders', value: String(stats.total_orders) },
                        { label: 'Spent', value: `${settings.currency}${stats.total_spent.toFixed(0)}` },
                        { label: 'Points', value: `⭐ ${customer.points}` },
                    ].map((stat) => (
                        <div key={stat.label} className="p-3 text-center" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                            <p className="text-lg font-black" style={{ color: P.espresso }}>{stat.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: P.caramel }}>{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Loyalty cups */}
                {settings.loyalty_cups_enabled && (
                    <div className="p-4" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.espresso }}>☕ Cup progress</p>
                            <p className="text-xs" style={{ color: P.caramel }}>{customer.cup_count}/{settings.loyalty_cups_threshold}</p>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: P.sand }}>
                            <div className="h-full rounded-full" style={{ background: P.terracotta, width: `${Math.min((customer.cup_count / settings.loyalty_cups_threshold) * 100, 100)}%` }} />
                        </div>
                        {customer.free_drinks_available > 0 && (
                            <p className="mt-2 text-xs font-bold" style={{ color: P.terracotta }}>
                                🎁 {customer.free_drinks_available} free drink{customer.free_drinks_available > 1 ? 's' : ''} available — redeem at checkout!
                            </p>
                        )}
                    </div>
                )}

                {/* Edit profile */}
                <form onSubmit={submit} className="space-y-3 p-4" style={{ background: P.creamLight, border: `2px solid ${P.sand}` }}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: P.espresso }}>Edit profile</p>
                    <div>
                        <label className="text-sm font-semibold" style={{ color: P.espresso }}>Full Name</label>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="mt-1 w-full bg-white px-3 py-2.5 text-sm focus:outline-none"
                            style={{ border: `2px solid ${errors.name ? '#EF4444' : P.sand}` }}
                        />
                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-semibold" style={{ color: P.espresso }}>Phone</label>
                        <input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            placeholder="09171234567"
                            className="mt-1 w-full bg-white px-3 py-2.5 text-sm focus:outline-none"
                            style={{ border: `2px solid ${errors.phone ? '#EF4444' : P.sand}` }}
                        />
                        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-semibold" style={{ color: P.espresso }}>Email</label>
                        <input value={customer.email} disabled className="mt-1 w-full px-3 py-2.5 text-sm opacity-60" style={{ border: `2px solid ${P.sand}`, background: P.sand }} />
                    </div>
                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-50"
                        style={{ background: P.navy }}
                    >
                        {processing ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>

                {/* Logout */}
                <form action={customerAuthLogout()} method="POST">
                    <input type="hidden" name="_token" value={typeof document !== 'undefined' ? (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '') : ''} />
                    <button type="submit" className="flex w-full items-center justify-center gap-2 py-3 text-sm font-bold uppercase tracking-widest" style={{ border: `2px solid ${P.terracotta}`, color: P.terracotta }}>
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </form>
            </div>

            <CustomerNav current="profile" />
        </div>
    );
}
