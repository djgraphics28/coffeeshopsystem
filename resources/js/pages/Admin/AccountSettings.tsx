import { Head, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, KeyRound, Save, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import AdminLayout from '@/layouts/admin-layout';

type Auth = { user: { name: string; email: string; email_verified_at: string | null } };

interface Props {
    mustVerifyEmail: boolean;
    status?: string;
}

export default function AccountSettings({ mustVerifyEmail, status }: Props) {
    const { auth } = usePage().props as { auth: Auth };

    // ── Profile form ──────────────────────────────────────────────────────────
    const {
        data: profileData,
        setData: setProfileData,
        patch: patchProfile,
        processing: profileProcessing,
        errors: profileErrors,
        reset: resetProfile,
    } = useForm({ name: auth.user.name, email: auth.user.email });

    function submitProfile(e: React.FormEvent) {
        e.preventDefault();
        patchProfile('/settings/profile', {
            preserveScroll: true,
            onSuccess: () => toast.success('Profile updated.'),
        });
    }

    // ── Password form ─────────────────────────────────────────────────────────
    const {
        data: pwData,
        setData: setPwData,
        put: putPassword,
        processing: pwProcessing,
        errors: pwErrors,
        reset: resetPw,
    } = useForm({ current_password: '', password: '', password_confirmation: '' });

    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const newPwRef = useRef<HTMLInputElement>(null);
    const currentPwRef = useRef<HTMLInputElement>(null);

    function submitPassword(e: React.FormEvent) {
        e.preventDefault();
        putPassword('/settings/password', {
            preserveScroll: true,
            onSuccess: () => {
                resetPw();
                toast.success('Password updated.');
            },
            onError: (errors) => {
                if (errors.password) newPwRef.current?.focus();
                if (errors.current_password) currentPwRef.current?.focus();
            },
        });
    }

    // flash status from server (verification link sent, etc.)
    useEffect(() => {
        if (status === 'verification-link-sent') toast.success('Verification link sent to your email.');
    }, [status]);

    const inputCls = 'w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400';
    const inputStyle = { background: 'var(--ap-bg)', border: '1px solid var(--ap-border)', color: 'var(--ap-input-text)' };

    return (
        <AdminLayout>
            <Head title="Account Settings — Admin" />
            <Toaster position="top-right" />

            <div className="mx-auto max-w-2xl space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--ap-input-text)', fontFamily: "'Playfair Display', serif" }}>
                        Account Settings
                    </h1>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--ap-muted)' }}>
                        Manage your profile and password.
                    </p>
                </div>

                {/* ── Profile Section ── */}
                <div className="rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--ap-border)' }}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#D4A84322' }}>
                            <UserCircle className="h-5 w-5" style={{ color: '#D4A843' }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>Profile Information</h2>
                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>Update your name and email address</p>
                        </div>
                    </div>

                    <form onSubmit={submitProfile} className="space-y-4 p-6">
                        {/* Avatar preview */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: '#2C1A0E' }}>
                                {profileData.name.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--ap-input-text)' }}>{profileData.name || '—'}</p>
                                <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>{profileData.email || '—'}</p>
                            </div>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Full Name</label>
                            <input
                                value={profileData.name}
                                onChange={(e) => setProfileData('name', e.target.value)}
                                placeholder="Your full name"
                                required
                                autoComplete="name"
                                className={inputCls}
                                style={inputStyle}
                            />
                            {profileErrors.name && <p className="mt-1 text-xs text-red-500">{profileErrors.name}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Email Address</label>
                            <input
                                type="email"
                                value={profileData.email}
                                onChange={(e) => setProfileData('email', e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="username"
                                className={inputCls}
                                style={inputStyle}
                            />
                            {profileErrors.email && <p className="mt-1 text-xs text-red-500">{profileErrors.email}</p>}
                        </div>

                        {mustVerifyEmail && !auth.user.email_verified_at && (
                            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF3C7', color: '#92400E' }}>
                                Your email is unverified.{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetch('/email/verification-notification', { method: 'POST', headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '' } });
                                        toast.success('Verification link sent!');
                                    }}
                                    className="font-semibold underline"
                                >
                                    Resend verification
                                </button>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={profileProcessing}
                                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                                style={{ background: '#2C1A0E', color: '#D4A843' }}
                            >
                                <Save className="h-4 w-4" />
                                {profileProcessing ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Password Section ── */}
                <div className="rounded-2xl shadow-sm" style={{ background: 'var(--ap-card)', border: '1px solid var(--ap-border)' }}>
                    <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: 'var(--ap-border)' }}>
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: '#3B82F622' }}>
                            <KeyRound className="h-5 w-5" style={{ color: '#3B82F6' }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold" style={{ color: 'var(--ap-input-text)' }}>Change Password</h2>
                            <p className="text-xs" style={{ color: 'var(--ap-muted)' }}>Use a strong, unique password</p>
                        </div>
                    </div>

                    <form onSubmit={submitPassword} className="space-y-4 p-6">
                        <div>
                            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Current Password</label>
                            <div className="relative">
                                <input
                                    ref={currentPwRef}
                                    type={showCurrent ? 'text' : 'password'}
                                    value={pwData.current_password}
                                    onChange={(e) => setPwData('current_password', e.target.value)}
                                    placeholder="Enter current password"
                                    autoComplete="current-password"
                                    className={`${inputCls} pr-10`}
                                    style={inputStyle}
                                />
                                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }}>
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {pwErrors.current_password && <p className="mt-1 text-xs text-red-500">{pwErrors.current_password}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>New Password</label>
                            <div className="relative">
                                <input
                                    ref={newPwRef}
                                    type={showNew ? 'text' : 'password'}
                                    value={pwData.password}
                                    onChange={(e) => setPwData('password', e.target.value)}
                                    placeholder="New password"
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-10`}
                                    style={inputStyle}
                                />
                                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }}>
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {pwErrors.password && <p className="mt-1 text-xs text-red-500">{pwErrors.password}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ap-input-text)' }}>Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={pwData.password_confirmation}
                                    onChange={(e) => setPwData('password_confirmation', e.target.value)}
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-10`}
                                    style={inputStyle}
                                />
                                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ap-muted)' }}>
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {pwErrors.password_confirmation && <p className="mt-1 text-xs text-red-500">{pwErrors.password_confirmation}</p>}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={pwProcessing}
                                className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50"
                                style={{ background: '#2C1A0E', color: '#D4A843' }}
                            >
                                <KeyRound className="h-4 w-4" />
                                {pwProcessing ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
