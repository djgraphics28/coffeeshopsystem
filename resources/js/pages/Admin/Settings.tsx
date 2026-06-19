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
        pay_as_you_order: settings.pay_as_you_order === '1',
        points_earn_rate: settings.points_earn_rate ?? '1',
        points_redeem_rate: settings.points_redeem_rate ?? '100',
        loyalty_cups_enabled: settings.loyalty_cups_enabled === '1',
        loyalty_cups_threshold: settings.loyalty_cups_threshold ?? '10',
        // Mail SMTP
        mail_host: settings.mail_host ?? '',
        mail_port: settings.mail_port ?? '587',
        mail_username: settings.mail_username ?? '',
        mail_password: settings.mail_password ?? '',
        mail_encryption: settings.mail_encryption ?? 'tls',
        mail_from_address: settings.mail_from_address ?? '',
        mail_from_name: settings.mail_from_name ?? '',
        // Pusher
        pusher_app_id: settings.pusher_app_id ?? '',
        pusher_app_key: settings.pusher_app_key ?? '',
        pusher_app_secret: settings.pusher_app_secret ?? '',
        pusher_app_cluster: settings.pusher_app_cluster ?? 'ap1',
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
                            <div className="col-span-2">
                                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Pay as You Order</p>
                                        <p className="mt-0.5 text-xs" style={{ color: 'var(--ap-muted)' }}>Automatically open payment after placing an order in POS</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setData('pay_as_you_order', !data.pay_as_you_order)}
                                        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                                        style={{ background: data.pay_as_you_order ? '#D4A843' : '#E5E7EB' }}
                                        role="switch"
                                        aria-checked={data.pay_as_you_order}
                                    >
                                        <span
                                            className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                                            style={{ transform: data.pay_as_you_order ? 'translateX(20px)' : 'translateX(0)' }}
                                        />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-4 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Loyalty Points</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Points Earned per ₱1</label>
                                <input type="number" step="0.1" min="0" value={data.points_earn_rate} onChange={(e) => setData('points_earn_rate', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>e.g. 1 = 1 point per peso spent</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Points Needed per ₱1 Discount</label>
                                <input type="number" step="1" min="1" value={data.points_redeem_rate} onChange={(e) => setData('points_redeem_rate', e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                                <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>e.g. 100 = 100 points = ₱1 off</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-1 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Loyalty Cup Promo</h2>
                        <p className="mb-4 text-xs" style={{ color: 'var(--ap-muted)' }}>Customers earn 1 free drink every N cups purchased.</p>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Enable Cup Loyalty</p>
                                    <p className="mt-0.5 text-xs" style={{ color: 'var(--ap-muted)' }}>Track cups and reward free drinks automatically</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setData('loyalty_cups_enabled', !data.loyalty_cups_enabled)}
                                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                                    style={{ background: data.loyalty_cups_enabled ? '#D4A843' : '#E5E7EB' }}
                                    role="switch"
                                    aria-checked={data.loyalty_cups_enabled}
                                >
                                    <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: data.loyalty_cups_enabled ? 'translateX(20px)' : 'translateX(0)' }} />
                                </button>
                            </div>
                            {data.loyalty_cups_enabled && (
                                <div>
                                    <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Cups Required for 1 Free Drink</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={data.loyalty_cups_threshold}
                                        onChange={(e) => setData('loyalty_cups_threshold', e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none"
                                    />
                                    <p className="mt-1 text-xs" style={{ color: 'var(--ap-muted)' }}>
                                        e.g. {data.loyalty_cups_threshold} = buy {data.loyalty_cups_threshold} drinks → get 1 free
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Email SMTP */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-1 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Email (SMTP)</h2>
                        <p className="mb-4 text-xs" style={{ color: 'var(--ap-muted)' }}>Used for sending verification emails and notifications to customers.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>SMTP Host</label>
                                <input value={data.mail_host} onChange={(e) => setData('mail_host', e.target.value)} placeholder="smtp.hostinger.com" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Port</label>
                                <input type="number" value={data.mail_port} onChange={(e) => setData('mail_port', e.target.value)} placeholder="587" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Encryption</label>
                                <select value={data.mail_encryption} onChange={(e) => setData('mail_encryption', e.target.value as 'tls' | 'ssl' | 'none')} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none bg-white">
                                    <option value="tls">TLS</option>
                                    <option value="ssl">SSL</option>
                                    <option value="none">None</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Username</label>
                                <input value={data.mail_username} onChange={(e) => setData('mail_username', e.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Password</label>
                                <input type="password" value={data.mail_password} onChange={(e) => setData('mail_password', e.target.value)} placeholder="••••••••" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>From Address</label>
                                <input type="email" value={data.mail_from_address} onChange={(e) => setData('mail_from_address', e.target.value)} placeholder="noreply@example.com" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>From Name</label>
                                <input value={data.mail_from_name} onChange={(e) => setData('mail_from_name', e.target.value)} placeholder="Milk&Honey Cafe" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Pusher Broadcasting */}
                    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: '1px solid var(--ap-border)' }}>
                        <h2 className="mb-1 font-semibold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>Broadcasting (Pusher)</h2>
                        <p className="mb-4 text-xs" style={{ color: 'var(--ap-muted)' }}>Real-time updates for kitchen display, order tracking, and POS. Get your credentials at <span className="font-medium">pusher.com</span>.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>App ID</label>
                                <input value={data.pusher_app_id} onChange={(e) => setData('pusher_app_id', e.target.value)} placeholder="1234567" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none font-mono" />
                            </div>
                            <div>
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Cluster</label>
                                <input value={data.pusher_app_cluster} onChange={(e) => setData('pusher_app_cluster', e.target.value)} placeholder="ap1" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none font-mono" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>App Key</label>
                                <input value={data.pusher_app_key} onChange={(e) => setData('pusher_app_key', e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none font-mono" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>App Secret</label>
                                <input type="password" value={data.pusher_app_secret} onChange={(e) => setData('pusher_app_secret', e.target.value)} placeholder="••••••••••••••••••••••••" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none font-mono" />
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
