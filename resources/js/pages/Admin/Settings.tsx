import { Head, useForm, usePage } from '@inertiajs/react';
import toast, { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import AdminLayout from '@/layouts/admin-layout';
import { adminSettingsUpdate } from '@/lib/routes';
import { PageHeader } from '@/components/admin/page-header';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';

interface Props {
    settings: Record<string, string>;
    gcash_qr_url: string | null;
    maya_qr_url: string | null;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-1 mb-4 text-xs text-muted-foreground">{description}</p>}
            <div className={description ? '' : 'mt-4'}>{children}</div>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-muted'}`}
            role="switch"
            aria-checked={checked}
        >
            <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
            />
        </button>
    );
}

export default function SettingsPage({ settings, gcash_qr_url, maya_qr_url }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };

    const { data, setData, post, processing, errors } = useForm({
        _method: 'PUT',
        // Online payments
        gcash_number: settings.gcash_number ?? '',
        gcash_account_name: settings.gcash_account_name ?? '',
        gcash_qr: null as File | null,
        maya_number: settings.maya_number ?? '',
        maya_account_name: settings.maya_account_name ?? '',
        maya_qr: null as File | null,
        // Delivery
        delivery_fee: settings.delivery_fee ?? '0',
        free_delivery_minimum: settings.free_delivery_minimum ?? '0',
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
        // POST with _method=PUT so QR image files upload correctly (multipart)
        post(adminSettingsUpdate(), { forceFormData: true });
    }

    return (
        <AdminLayout>
            <Head title="Settings — Admin" />
            <Toaster position="top-right" />
            <div className="max-w-2xl">
                <PageHeader title="Settings" breadcrumbs={[{ label: 'Settings' }]} />

                <form onSubmit={submit} className="space-y-6">
                    <Section title="Cafe Info">
                        <div className="space-y-4">
                            <FormField label="Cafe Name">
                                <input value={data.cafe_name} onChange={(e) => setData('cafe_name', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Tagline">
                                <input value={data.cafe_tagline} onChange={(e) => setData('cafe_tagline', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                        </div>
                    </Section>

                    <Section title="Pricing">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Tax Rate (%)">
                                <input type="number" step="0.01" value={data.tax_rate} onChange={(e) => setData('tax_rate', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Currency Symbol">
                                <input value={data.currency} onChange={(e) => setData('currency', e.target.value)} className={adminFieldClass()} maxLength={5} />
                            </FormField>
                        </div>
                    </Section>

                    <Section title="Operations">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Opening Time">
                                <input type="time" value={data.opening_time} onChange={(e) => setData('opening_time', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Closing Time">
                                <input type="time" value={data.closing_time} onChange={(e) => setData('closing_time', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Estimated Wait (shown to customers)" className="col-span-2">
                                <input value={data.estimated_wait_minutes} onChange={(e) => setData('estimated_wait_minutes', e.target.value)} className={adminFieldClass()} placeholder="10-15" />
                            </FormField>
                            <div className="col-span-2 flex items-center justify-between rounded-xl border border-border px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Pay as You Order</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Automatically open payment after placing an order in POS</p>
                                </div>
                                <Toggle checked={data.pay_as_you_order} onChange={() => setData('pay_as_you_order', !data.pay_as_you_order)} />
                            </div>
                        </div>
                    </Section>

                    <Section title="Loyalty Points">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Points Earned per ₱1" hint="e.g. 1 = 1 point per peso spent">
                                <input type="number" step="0.1" min="0" value={data.points_earn_rate} onChange={(e) => setData('points_earn_rate', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Points Needed per ₱1 Discount" hint="e.g. 100 = 100 points = ₱1 off">
                                <input type="number" step="1" min="1" value={data.points_redeem_rate} onChange={(e) => setData('points_redeem_rate', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                        </div>
                    </Section>

                    <Section title="Loyalty Cup Promo" description="Customers earn 1 free drink every N cups purchased.">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Enable Cup Loyalty</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Track cups and reward free drinks automatically</p>
                                </div>
                                <Toggle checked={data.loyalty_cups_enabled} onChange={() => setData('loyalty_cups_enabled', !data.loyalty_cups_enabled)} />
                            </div>
                            {data.loyalty_cups_enabled && (
                                <FormField label="Cups Required for 1 Free Drink" hint={`e.g. ${data.loyalty_cups_threshold} = buy ${data.loyalty_cups_threshold} drinks → get 1 free`}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={data.loyalty_cups_threshold}
                                        onChange={(e) => setData('loyalty_cups_threshold', e.target.value)}
                                        className={adminFieldClass()}
                                    />
                                </FormField>
                            )}
                        </div>
                    </Section>

                    {/* Email SMTP */}
                    <Section title="Email (SMTP)" description="Used for sending verification emails and notifications to customers.">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="SMTP Host" className="col-span-2">
                                <input value={data.mail_host} onChange={(e) => setData('mail_host', e.target.value)} placeholder="smtp.hostinger.com" className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Port">
                                <input type="number" value={data.mail_port} onChange={(e) => setData('mail_port', e.target.value)} placeholder="587" className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Encryption">
                                <select value={data.mail_encryption} onChange={(e) => setData('mail_encryption', e.target.value as 'tls' | 'ssl' | 'none')} className={adminFieldClass()}>
                                    <option value="tls">TLS</option>
                                    <option value="ssl">SSL</option>
                                    <option value="none">None</option>
                                </select>
                            </FormField>
                            <FormField label="Username">
                                <input value={data.mail_username} onChange={(e) => setData('mail_username', e.target.value)} placeholder="you@example.com" className={adminFieldClass()} />
                            </FormField>
                            <FormField label="Password">
                                <input type="password" value={data.mail_password} onChange={(e) => setData('mail_password', e.target.value)} placeholder="••••••••" className={adminFieldClass()} />
                            </FormField>
                            <FormField label="From Address">
                                <input type="email" value={data.mail_from_address} onChange={(e) => setData('mail_from_address', e.target.value)} placeholder="noreply@example.com" className={adminFieldClass()} />
                            </FormField>
                            <FormField label="From Name">
                                <input value={data.mail_from_name} onChange={(e) => setData('mail_from_name', e.target.value)} placeholder="Milk&Honey Cafe" className={adminFieldClass()} />
                            </FormField>
                        </div>
                    </Section>

                    {/* Pusher Broadcasting */}
                    <Section title="Broadcasting (Pusher)" description="Real-time updates for kitchen display, order tracking, and POS. Get your credentials at pusher.com.">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="App ID">
                                <input value={data.pusher_app_id} onChange={(e) => setData('pusher_app_id', e.target.value)} placeholder="1234567" className={adminFieldClass() + ' font-mono'} />
                            </FormField>
                            <FormField label="Cluster">
                                <input value={data.pusher_app_cluster} onChange={(e) => setData('pusher_app_cluster', e.target.value)} placeholder="ap1" className={adminFieldClass() + ' font-mono'} />
                            </FormField>
                            <FormField label="App Key" className="col-span-2">
                                <input value={data.pusher_app_key} onChange={(e) => setData('pusher_app_key', e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" className={adminFieldClass() + ' font-mono'} />
                            </FormField>
                            <FormField label="App Secret" className="col-span-2">
                                <input type="password" value={data.pusher_app_secret} onChange={(e) => setData('pusher_app_secret', e.target.value)} placeholder="••••••••••••••••••••••••" className={adminFieldClass() + ' font-mono'} />
                            </FormField>
                        </div>
                    </Section>

                    {/* Delivery */}
                    <Section title="Delivery" description="Charged on online delivery orders. Set a minimum order amount to give free delivery.">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label={`Delivery Fee (${data.currency})`} hint="0 = delivery is always free">
                                <input type="number" step="0.01" min="0" value={data.delivery_fee as string} onChange={(e) => setData('delivery_fee', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                            <FormField label={`Free Delivery Minimum (${data.currency})`} hint="Orders at or above this amount get free delivery. 0 = never free.">
                                <input type="number" step="0.01" min="0" value={data.free_delivery_minimum as string} onChange={(e) => setData('free_delivery_minimum', e.target.value)} className={adminFieldClass()} />
                            </FormField>
                        </div>
                    </Section>

                    {/* Online Payments */}
                    <Section title="Online Payments (GCash / Maya)" description="Shown to customers as payment instructions when they choose GCash or Maya for online orders.">
                        {([
                            { key: 'gcash', label: 'GCash', numberField: 'gcash_number', nameField: 'gcash_account_name', qrField: 'gcash_qr', currentUrl: gcash_qr_url },
                            { key: 'maya', label: 'Maya', numberField: 'maya_number', nameField: 'maya_account_name', qrField: 'maya_qr', currentUrl: maya_qr_url },
                        ] as const).map((wallet) => (
                            <div key={wallet.key} className="mb-4 rounded-xl border border-border p-4 last:mb-0">
                                <p className="mb-3 text-sm font-semibold text-foreground">{wallet.label}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label={`${wallet.label} Number`}>
                                        <input
                                            value={data[wallet.numberField] as string}
                                            onChange={(e) => setData(wallet.numberField, e.target.value)}
                                            placeholder="09171234567"
                                            className={adminFieldClass()}
                                        />
                                    </FormField>
                                    <FormField label="Account Name">
                                        <input
                                            value={data[wallet.nameField] as string}
                                            onChange={(e) => setData(wallet.nameField, e.target.value)}
                                            placeholder="Juan D."
                                            className={adminFieldClass()}
                                        />
                                    </FormField>
                                    <FormField label={`${wallet.label} QR Code`} className="col-span-2" error={errors[wallet.qrField]}>
                                        <div className="flex items-center gap-4">
                                            {(data[wallet.qrField] || wallet.currentUrl) && (
                                                <img
                                                    src={data[wallet.qrField] ? URL.createObjectURL(data[wallet.qrField] as File) : wallet.currentUrl!}
                                                    alt={`${wallet.label} QR code`}
                                                    className="h-24 w-24 rounded-lg border border-border object-contain"
                                                />
                                            )}
                                            <label className="cursor-pointer rounded-xl border border-dashed border-border px-4 py-3 text-xs font-medium text-muted-foreground hover:border-primary">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => setData(wallet.qrField, e.target.files?.[0] ?? null)}
                                                />
                                                {data[wallet.qrField]
                                                    ? `✓ ${(data[wallet.qrField] as File).name}`
                                                    : wallet.currentUrl ? 'Replace QR image' : 'Upload QR image'}
                                            </label>
                                        </div>
                                    </FormField>
                                </div>
                            </div>
                        ))}
                    </Section>

                    <Button type="submit" disabled={processing} size="lg">
                        {processing ? 'Saving...' : 'Save Settings'}
                    </Button>
                </form>
            </div>
        </AdminLayout>
    );
}
