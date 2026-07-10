import { Head, Link, useForm } from '@inertiajs/react';
import { customerAuthLogin, customerAuthRegisterStore } from '@/lib/routes';
import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Props { qrToken: string | null; recaptchaSiteKey: string | null }

declare global {
    interface Window {
        grecaptcha?: {
            ready: (cb: () => void) => void;
            execute: (siteKey: string, options: { action: string }) => Promise<string>;
        };
    }
}

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

export default function CustomerRegister({ qrToken, recaptchaSiteKey }: Props) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, transform } = useForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        qrToken: qrToken ?? '',
        recaptcha_token: '',
    });

    useEffect(() => {
        if (!recaptchaSiteKey || document.getElementById('recaptcha-script')) return;
        const script = document.createElement('script');
        script.id = 'recaptcha-script';
        script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
        script.async = true;
        document.head.appendChild(script);
    }, [recaptchaSiteKey]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();

        let token = '';
        if (recaptchaSiteKey && window.grecaptcha) {
            try {
                await new Promise<void>((resolve) => window.grecaptcha!.ready(resolve));
                token = await window.grecaptcha.execute(recaptchaSiteKey, { action: 'register' });
            } catch {
                // Verification happens server-side; an empty token will be rejected there
            }
        }

        transform((formData) => ({ ...formData, recaptcha_token: token }));
        post(customerAuthRegisterStore());
    }

    return (
        <div className="customer-page relative flex min-h-screen flex-col overflow-hidden sm:items-center sm:justify-center sm:py-12" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Head title="Register — Milk&Honey" />
            <GeometricBackdrop />

            <div className="relative flex w-full flex-1 flex-col sm:max-w-md sm:flex-none sm:shadow-xl" style={{ background: P.creamLight }}>
                {/* Header */}
                <div className="flex flex-col items-center justify-center py-8" style={{ background: P.navy }}>
                    <CafeLogo />
                    <p className="mt-2 text-xs font-bold uppercase tracking-widest" style={{ color: P.cream }}>Create your account</p>
                </div>

                <div className="flex-1 px-6 py-8 sm:px-8">
                    <h1 className="mb-1 text-2xl font-black uppercase tracking-tight" style={{ color: P.espresso }}>Join Milk&Honey</h1>
                    <p className="mb-6 text-sm" style={{ color: P.caramel }}>Earn points on every order</p>

                    <form onSubmit={submit} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold" style={{ color: P.espresso }}>Full Name *</label>
                            <input
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                autoComplete="name"
                                className="mt-1 w-full bg-white px-3 py-3 text-sm focus:outline-none"
                                style={{ border: `2px solid ${errors.name ? '#EF4444' : P.sand}` }}
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-semibold" style={{ color: P.espresso }}>Email *</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                autoComplete="email"
                                className="mt-1 w-full bg-white px-3 py-3 text-sm focus:outline-none"
                                style={{ border: `2px solid ${errors.email ? '#EF4444' : P.sand}` }}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-semibold" style={{ color: P.espresso }}>Phone <span style={{ color: P.caramel }}>(optional)</span></label>
                            <input
                                type="tel"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                placeholder="09171234567"
                                className="mt-1 w-full bg-white px-3 py-3 text-sm focus:outline-none"
                                style={{ border: `2px solid ${P.sand}` }}
                            />
                            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-semibold" style={{ color: P.espresso }}>Password *</label>
                            <div className="relative mt-1">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full bg-white px-3 py-3 pr-10 text-sm focus:outline-none"
                                    style={{ border: `2px solid ${errors.password ? '#EF4444' : P.sand}` }}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: P.caramel }}>
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                        </div>

                        <div>
                            <label className="text-sm font-semibold" style={{ color: P.espresso }}>Confirm Password *</label>
                            <input
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                autoComplete="new-password"
                                className="mt-1 w-full bg-white px-3 py-3 text-sm focus:outline-none"
                                style={{ border: `2px solid ${P.sand}` }}
                            />
                        </div>

                        <div className="p-3 text-xs font-semibold text-white" style={{ background: P.caramel }}>
                            ⭐ Earn loyalty points on every order — redeem them for discounts!
                        </div>

                        {errors.recaptcha_token && (
                            <p className="text-xs text-red-500">{errors.recaptcha_token}</p>
                        )}

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-transform hover:scale-[1.01] disabled:opacity-50"
                            style={{ background: P.terracotta }}
                        >
                            {processing ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm" style={{ color: P.caramel }}>
                        Already have an account?{' '}
                        <Link href={customerAuthLogin(qrToken ?? undefined)} className="font-bold" style={{ color: P.terracotta }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

function CafeLogo() {
    return (
        <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 17.314 10.686 20 14 20C17.314 20 20 17.314 20 14C20 8 14 2 14 2Z" fill="#C05B2D" />
                <path d="M14 20V26M11 26H17" stroke="#C05B2D" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xl font-black uppercase tracking-tight text-white">
                Milk&Honey
            </span>
        </div>
    );
}

/* Decorative circles/semicircles behind the card (desktop) */
function GeometricBackdrop() {
    return (
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden="true">
            <div className="absolute -left-16 top-10 h-48 w-48 rounded-full" style={{ background: P.terracotta, opacity: 0.85 }} />
            <div className="absolute left-24 top-44 h-24 w-24 rounded-full" style={{ background: P.navy }} />
            <div className="absolute -left-8 bottom-8 h-44 w-44" style={{ background: P.caramel, borderRadius: '0 100% 0 0' }} />
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full" style={{ background: P.caramel, opacity: 0.55 }} />
            <div className="absolute right-16 bottom-0 h-36 w-36" style={{ background: P.terracotta, opacity: 0.7, borderRadius: '100% 0 0 0' }} />
            <div className="absolute right-56 bottom-24 h-16 w-16 rounded-full" style={{ background: P.navy, opacity: 0.85 }} />
        </div>
    );
}
