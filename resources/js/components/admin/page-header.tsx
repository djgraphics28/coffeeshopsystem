import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import * as React from 'react';
import { adminDashboard } from '@/lib/routes';

type Crumb = { label: string; href?: string };

type PageHeaderProps = {
    title: string;
    breadcrumbs?: Crumb[];
    actions?: React.ReactNode;
};

/** TailAdmin-style page title bar: heading on the left, breadcrumb trail + optional actions on the right. */
export function PageHeader({ title, breadcrumbs = [], actions }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
                <nav className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Link href={adminDashboard()} className="hover:text-primary">
                        Home
                    </Link>
                    {breadcrumbs.map((crumb) => (
                        <span key={crumb.label} className="flex items-center gap-1.5">
                            <ChevronRight className="h-3.5 w-3.5" />
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-primary">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-foreground">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
    );
}
