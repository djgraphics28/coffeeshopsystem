import { Head, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, KeyRound, Save, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
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
                if (errors.password) {
newPwRef.current?.focus();
}

                if (errors.current_password) {
currentPwRef.current?.focus();
}
            },
        });
    }

    // flash status from server (verification link sent, etc.)
    useEffect(() => {
        if (status === 'verification-link-sent') {
toast.success('Verification link sent to your email.');
}
    }, [status]);

    return (
        <AdminLayout>
            <Head title="Account Settings" />
            <Toaster position="top-right" />

            <div className="mx-auto max-w-2xl space-y-6">
                <PageHeader title="Account Settings" breadcrumbs={[{ label: 'Account' }]} />
                <p className="-mt-4 text-sm text-muted-foreground">Manage your profile and password.</p>

                {/* ── Profile Section ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/15">
                            <UserCircle className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Profile Information</h2>
                            <p className="text-xs text-muted-foreground">Update your name and email address</p>
                        </div>
                    </div>

                    <form onSubmit={submitProfile} className="space-y-4 p-6">
                        {/* Avatar preview */}
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                                {profileData.name.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">{profileData.name || '—'}</p>
                                <p className="text-xs text-muted-foreground">{profileData.email || '—'}</p>
                            </div>
                        </div>

                        <FormField label="Full Name" error={profileErrors.name}>
                            <input
                                value={profileData.name}
                                onChange={(e) => setProfileData('name', e.target.value)}
                                placeholder="Your full name"
                                required
                                autoComplete="name"
                                className={adminFieldClass(!!profileErrors.name)}
                            />
                        </FormField>

                        <FormField label="Email Address" error={profileErrors.email}>
                            <input
                                type="email"
                                value={profileData.email}
                                onChange={(e) => setProfileData('email', e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoComplete="username"
                                className={adminFieldClass(!!profileErrors.email)}
                            />
                        </FormField>

                        {mustVerifyEmail && !auth.user.email_verified_at && (
                            <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
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
                            <Button type="submit" disabled={profileProcessing}>
                                <Save className="h-4 w-4" />
                                {profileProcessing ? 'Saving...' : 'Save Profile'}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* ── Password Section ── */}
                <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-3 border-b border-border px-6 py-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10">
                            <KeyRound className="h-5 w-5 text-info" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">Change Password</h2>
                            <p className="text-xs text-muted-foreground">Use a strong, unique password</p>
                        </div>
                    </div>

                    <form onSubmit={submitPassword} className="space-y-4 p-6">
                        <FormField label="Current Password" error={pwErrors.current_password}>
                            <div className="relative">
                                <input
                                    ref={currentPwRef}
                                    type={showCurrent ? 'text' : 'password'}
                                    value={pwData.current_password}
                                    onChange={(e) => setPwData('current_password', e.target.value)}
                                    placeholder="Enter current password"
                                    autoComplete="current-password"
                                    className={adminFieldClass(!!pwErrors.current_password) + ' pr-10'}
                                />
                                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </FormField>

                        <FormField label="New Password" error={pwErrors.password}>
                            <div className="relative">
                                <input
                                    ref={newPwRef}
                                    type={showNew ? 'text' : 'password'}
                                    value={pwData.password}
                                    onChange={(e) => setPwData('password', e.target.value)}
                                    placeholder="New password"
                                    autoComplete="new-password"
                                    className={adminFieldClass(!!pwErrors.password) + ' pr-10'}
                                />
                                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </FormField>

                        <FormField label="Confirm New Password" error={pwErrors.password_confirmation}>
                            <div className="relative">
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={pwData.password_confirmation}
                                    onChange={(e) => setPwData('password_confirmation', e.target.value)}
                                    placeholder="Confirm new password"
                                    autoComplete="new-password"
                                    className={adminFieldClass(!!pwErrors.password_confirmation) + ' pr-10'}
                                />
                                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </FormField>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={pwProcessing}>
                                <KeyRound className="h-4 w-4" />
                                {pwProcessing ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
