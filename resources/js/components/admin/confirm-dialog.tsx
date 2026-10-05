import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'default';
    loading?: boolean;
};

/**
 * Shared confirmation modal for destructive/irreversible actions
 * (delete, void order, mark COD, etc.) across the admin panel.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'danger',
    loading = false,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="admin-panel w-full max-w-sm rounded-2xl border-0 bg-card p-6 shadow-xl">
                <div className="flex flex-col items-center text-center">
                    <div
                        className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-full',
                            tone === 'danger' ? 'bg-error/10 text-error' : 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
                        )}
                    >
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <DialogTitle className="mt-4 text-base font-semibold text-foreground">{title}</DialogTitle>
                    {description && <DialogDescription className="mt-1 text-sm text-muted-foreground">{description}</DialogDescription>}
                </div>

                <DialogFooter className="mt-6 gap-2 sm:justify-center">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        variant={tone === 'danger' ? 'destructive' : 'default'}
                        className="flex-1"
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? 'Please wait…' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
