import * as React from 'react';
import { cn } from '@/lib/utils';

export function TableCard({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>{children}</div>
    );
}

export function TableScroll({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('overflow-x-auto', className)}>{children}</div>;
}

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
    return <table className={cn('w-full text-left text-sm', className)}>{children}</table>;
}

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
    return <thead className={cn('bg-muted/60', className)}>{children}</thead>;
}

export function TableHeadCell({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <th
            scope="col"
            className={cn(
                'px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase whitespace-nowrap',
                className,
            )}
        >
            {children}
        </th>
    );
}

export function TableBody({ className, children }: { className?: string; children: React.ReactNode }) {
    return <tbody className={cn('divide-y divide-border', className)}>{children}</tbody>;
}

export function TableRow({
    className,
    children,
    ...props
}: React.ComponentProps<'tr'>) {
    return (
        <tr className={cn('transition-colors hover:bg-muted/40', className)} {...props}>
            {children}
        </tr>
    );
}

export function TableCell({ className, children, ...props }: React.ComponentProps<'td'>) {
    return (
        <td className={cn('px-5 py-3.5 align-middle text-foreground', className)} {...props}>
            {children}
        </td>
    );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-5 py-14 text-center text-sm text-muted-foreground">
                {children}
            </td>
        </tr>
    );
}
