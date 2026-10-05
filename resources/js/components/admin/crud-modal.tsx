import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type CrudModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
    contentClassName?: string;
};

/**
 * Standard TailAdmin-style form modal used across every admin CRUD page.
 * Wraps the existing Radix `ui/dialog.tsx` primitives so behaviour
 * (focus trap, escape-to-close, overlay click) matches the rest of the app.
 */
export function CrudModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    className,
    contentClassName,
}: CrudModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    'admin-panel flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-card p-0 shadow-xl',
                    className,
                )}
            >
                <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
                    <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
                    {description && (
                        <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
                    )}
                </DialogHeader>

                <div className={cn('flex-1 overflow-y-auto px-6 py-5', contentClassName)}>{children}</div>

                {footer && (
                    <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/40 px-6 py-4 sm:justify-end">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
