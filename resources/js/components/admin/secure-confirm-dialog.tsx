import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import { adminFieldClass } from '@/components/admin/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    /** Plain-language explanation of what is about to happen. */
    children: React.ReactNode;
    /** The word the person must type to proceed, e.g. RESET. */
    word: string;
    confirmLabel: string;
    loading?: boolean;
    /** Server-side password error, shown under the password field. */
    passwordError?: string | null;
    onConfirm: (password: string) => void;
};

/**
 * Extra-careful confirmation for irreversible actions: the admin must retype their own password and type a
 * confirmation word, so a stray click or a borrowed session cannot trigger it.
 */
export function SecureConfirmDialog({ open, onOpenChange, title, children, word, confirmLabel, loading = false, passwordError, onConfirm }: Props) {
    const [password, setPassword] = useState('');
    const [typed, setTyped] = useState('');
    const [show, setShow] = useState(false);

    const ready = password.length > 0 && typed === word && !loading;

    function handleOpenChange(next: boolean) {
        if (loading) {
 return; 
}

        if (!next) {
            setPassword(''); setTyped(''); setShow(false);
        }

        onOpenChange(next);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="admin-panel flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-card p-0 shadow-xl">
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"><AlertTriangle className="h-5 w-5" /></span>
                        <div className="min-w-0">
                            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
                            <DialogDescription asChild><div className="mt-1 space-y-3 text-sm text-muted-foreground">{children}</div></DialogDescription>
                        </div>
                    </div>

                    <form
                        className="mt-5 space-y-4"
                        onSubmit={(e) => {
 e.preventDefault();

 if (ready) {
 onConfirm(password); 
} 
}}
                    >
                        <div>
                            <Label htmlFor="secure-password" className="mb-1.5 block text-sm font-medium text-foreground">Your password</Label>
                            <div className="relative">
                                <input
                                    id="secure-password" autoFocus type={show ? 'text' : 'password'} autoComplete="current-password"
                                    value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading}
                                    className={adminFieldClass(!!passwordError) + ' pr-10'}
                                />
                                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {passwordError && <p className="mt-1 text-xs text-error">{passwordError}</p>}
                        </div>
                        <div>
                            <Label htmlFor="secure-word" className="mb-1.5 block text-sm font-medium text-foreground">
                                Type <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-error">{word}</span> to confirm
                            </Label>
                            <input
                                id="secure-word" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={loading}
                                autoComplete="off" spellCheck={false} placeholder={word} className={adminFieldClass() + ' font-mono'}
                            />
                        </div>
                        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
                    </form>
                </div>

                <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:justify-end">
                    <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Cancel</Button>
                    <Button variant="destructive" onClick={() => onConfirm(password)} disabled={!ready}>
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Working…</> : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
