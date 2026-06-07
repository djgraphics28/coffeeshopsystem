import { Head, useForm, usePage } from '@inertiajs/react';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { adminSettingsUpdate } from '@/lib/routes';

interface Props { settings: Record<string, string> }

export default function SettingsPage({ settings }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };

    const { data, setData, put, processing, errors } = useForm({
        cafe_name: settings.cafe_name ?? '',
        cafe_tagline: settings.cafe_tagline ?? '',
        tax_rate: settings.tax_rate ?? '12',
        currency: settings.currency ?? '₱',
        opening_time: settings.opening_time ?? '07:00',
        closing_time: settings.closing_time ?? '21:00',
        estimated_wait_minutes: settings.estimated_wait_minutes ?? '10-15',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
    }, [flash]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        put(adminSettingsUpdate());
    }

    return (
        <AdminLayout>
            <Head title="Settings — Admin" />
            <Toaster position="top-right" />
            <div className="p-6 max-w-2xl">
                <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Settings</h1>

                <form onSubmit={submit} className="space-y-6">
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-4 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Cafe Info</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Cafe Name</label>
                                <input value={data.cafe_name} onChange={(e) => setData('cafe_name', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Tagline</label>
                                <input value={data.cafe_tagline} onChange={(e) => setData('cafe_tagline', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-4 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Pricing</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Tax Rate (%)</label>
                                <input type="number" step="0.01" value={data.tax_rate} onChange={(e) => setData('tax_rate', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Currency Symbol</label>
                                <input value={data.currency} onChange={(e) => setData('currency', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" maxLength={5} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-4 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Operations</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Opening Time</label>
                                <input type="time" value={data.opening_time} onChange={(e) => setData('opening_time', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Closing Time</label>
                                <input type="time" value={data.closing_time} onChange={(e) => setData('closing_time', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Estimated Wait (shown to customers)</label>
                                <input value={data.estimated_wait_minutes} onChange={(e) => setData('estimated_wait_minutes', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" placeholder="10-15" />
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={processing} className="rounded-full px-8 py-3 text-sm font-bold disabled:opacity-50" style={{ background: '#D4A843', color: '#2C1A0E' }}>
                        {processing ? 'Saving...' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </AdminLayout>
    );
}
