import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FormFieldProps = {
    label: React.ReactNode;
    htmlFor?: string;
    error?: string;
    required?: boolean;
    hint?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
};

/** Consistent label + control + inline-error layout for admin CRUD forms. */
export function FormField({ label, htmlFor, error, required, hint, className, children }: FormFieldProps) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
                {label}
                {required && <span className="ml-0.5 text-error">*</span>}
            </Label>
            {children}
            {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
            {error && <p className="text-xs text-error">{error}</p>}
        </div>
    );
}

/** Shared className for raw `<input>`/`<select>`/`<textarea>` elements inside `.admin-panel`, matching TailAdmin's field style. */
export const adminFieldClass = (hasError?: boolean) =>
    cn(
        'w-full rounded-lg border bg-transparent px-3.5 py-2.5 text-sm shadow-xs transition-colors outline-none',
        'focus:ring-3 focus:ring-primary/10',
        hasError ? 'border-error focus:border-error' : 'border-[var(--ap-input-border)] focus:border-primary',
    );
