import { Head, useForm, usePage } from '@inertiajs/react';
import { customerAuthEmailResend, customerAuthLogout } from '@/lib/routes';
import { Mail, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export default function CustomerVerifyEmail() {
    const { flash, errors } = usePage().props as {
        flash?: { success?: string };
        errors?: { verification?: string };
    };

    const [countdown, setCountdown] = useState(0);
    const { post, processing } = useForm({});

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (errors?.verification) toast.error(errors.verification);
    }, [flash, errors]);

    function resend() {
        post(customerAuthEmailResend(), {
            onSuccess: () => setCountdown(60),
        });
    }

    // Countdown timer after resend
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: '#FDF6EC', fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="Verify Your Email — Milk&Honey" />
            <Toaster position="top-center" />

            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: '#2C1A0E' }}>
                        <CafeLogo />
                    </div>
                    <p className="mt-3 text-sm font-medium" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>Milk&Honey Cafe</p>
                </div>

                {/* Card */}
                <div className="rounded-2xl bg-white p-8 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                    <div className="mb-5 flex justify-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#FEF3C7' }}>
                            <Mail className="h-7 w-7" style={{ color: '#D97706' }} />
                        </div>
                    </div>

                    <h1 className="mb-2 text-center text-xl font-bold" style={{ color: '#2C1A0E', fontFamily: "'Playfair Display', serif" }}>
                        Check your email
                    </h1>
                    <p className="mb-6 text-center text-sm leading-relaxed text-gray-500">
                        We sent a verification link to your email address. Click the link to activate your account and start ordering.
                    </p>

                    <button
                        onClick={resend}
                        disabled={processing || countdown > 0}
                        className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all disabled:opacity-50"
                        style={{ background: '#D4A843', color: '#2C1A0E' }}
                    >
                        <RefreshCw className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
                        {processing
                            ? 'Sending...'
                            : countdown > 0
                                ? `Resend in ${countdown}s`
                                : 'Resend verification email'
                        }
                    </button>

                    <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: '#FDF6EC', color: '#6B7280' }}>
                        <p className="font-medium mb-0.5" style={{ color: '#2C1A0E' }}>Didn't receive it?</p>
                        <ul className="space-y-1 list-disc list-inside">
                            <li>Check your spam or junk folder</li>
                            <li>Make sure you entered the right email</li>
                            <li>Wait a minute, then try resending</li>
                        </ul>
                    </div>
                </div>

                <form action={customerAuthLogout()} method="POST" className="mt-4 text-center">
                    <input type="hidden" name="_token" value={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''} />
                    <button type="submit" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        Use a different account
                    </button>
                </form>
            </div>
        </div>
    );
}

function CafeLogo() {
    return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 17.314 10.686 20 14 20C17.314 20 20 17.314 20 14C20 8 14 2 14 2Z" fill="#D4A843" />
            <path d="M14 20V26M11 26H17" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
