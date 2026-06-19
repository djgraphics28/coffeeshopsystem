import { Head, Link, useForm } from '@inertiajs/react';
import { customerAuthLogin, customerAuthRegisterStore } from '@/lib/routes';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface Props { qrToken: string | null }

export default function CustomerRegister({ qrToken }: Props) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: '',
        qrToken: qrToken ?? '',
    });

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(customerAuthRegisterStore());
    }

    return (
        <div className="flex min-h-screen flex-col" style={{ background: '#FDF6EC', fontFamily: "'DM Sans', sans-serif", maxWidth: '430px', margin: '0 auto' }}>
            <Head title="Register — Milk&Honey" />

            {/* Header */}
            <div className="flex flex-col items-center justify-center py-10" style={{ background: '#2C1A0E' }}>
                <CafeLogo />
                <p className="mt-2 text-sm opacity-70" style={{ color: '#D4A843' }}>Create your account</p>
            </div>

            <div className="flex-1 px-6 py-8">
                <h1 className="mb-1 text-2xl font-bold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>Join Milk&Honey</h1>
                <p className="mb-6 text-sm text-gray-500">Earn points on every order</p>

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Full Name *</label>
                        <input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            autoComplete="name"
                            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm focus:border-yellow-400 focus:outline-none"
                            style={{ borderColor: errors.name ? '#EF4444' : '#E5E7EB' }}
                        />
                        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Email *</label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            autoComplete="email"
                            className="mt-1 w-full rounded-xl border px-3 py-3 text-sm focus:border-yellow-400 focus:outline-none"
                            style={{ borderColor: errors.email ? '#EF4444' : '#E5E7EB' }}
                        />
                        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Phone <span className="text-gray-400">(optional)</span></label>
                        <input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            placeholder="09171234567"
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:border-yellow-400 focus:outline-none"
                        />
                        {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Password *</label>
                        <div className="relative mt-1">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                autoComplete="new-password"
                                className="w-full rounded-xl border px-3 py-3 pr-10 text-sm focus:border-yellow-400 focus:outline-none"
                                style={{ borderColor: errors.password ? '#EF4444' : '#E5E7EB' }}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                    </div>

                    <div>
                        <label className="text-sm font-medium" style={{ color: '#2C1A0E' }}>Confirm Password *</label>
                        <input
                            type="password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm focus:border-yellow-400 focus:outline-none"
                        />
                    </div>

                    <div className="rounded-xl p-3 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        ⭐ Earn loyalty points on every order — redeem them for discounts!
                    </div>

                    <button
                        type="submit"
                        disabled={processing}
                        className="w-full rounded-full py-3.5 text-sm font-bold disabled:opacity-50"
                        style={{ background: '#D4A843', color: '#2C1A0E' }}
                    >
                        {processing ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href={customerAuthLogin(qrToken ?? undefined)} className="font-semibold" style={{ color: '#D4A843' }}>
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

function CafeLogo() {
    return (
        <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 17.314 10.686 20 14 20C17.314 20 20 17.314 20 14C20 8 14 2 14 2Z" fill="#D4A843" />
                <path d="M14 20V26M11 26H17" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#FAF3E0' }}>
                Milk&Honey
            </span>
        </div>
    );
}
