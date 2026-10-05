import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PaginationMeta = {
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
    links: { url: string | null; label: string; active: boolean }[];
};

/**
 * Renders a Laravel paginator's `meta` block (as returned by Inertia's
 * paginated resources) as a TailAdmin-style pager: "Showing x-y of z" plus
 * numbered page buttons, using client-side `router.get` navigation.
 */
export function Pagination({ meta, className }: { meta: PaginationMeta; className?: string }) {
    if (meta.last_page <= 1) {
        return null;
    }

    return (
        <div className={cn('flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between', className)}>
            <p className="text-xs text-muted-foreground">
                Showing <span className="font-medium text-foreground">{meta.from}</span>–<span className="font-medium text-foreground">{meta.to}</span> of{' '}
                <span className="font-medium text-foreground">{meta.total}</span>
            </p>
            <div className="flex gap-1">
                {meta.links.map((link, i) => {
                    const isPrev = link.label.includes('Previous');
                    const isNext = link.label.includes('Next');
                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!link.url}
                            onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                            className={cn(
                                'flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
                                link.active
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border border-border bg-card text-muted-foreground hover:bg-muted',
                            )}
                        >
                            {isPrev ? (
                                <ChevronLeft className="h-3.5 w-3.5" />
                            ) : isNext ? (
                                <ChevronRight className="h-3.5 w-3.5" />
                            ) : (
                                <span dangerouslySetInnerHTML={{ __html: link.label }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
