import { AnimatePresence, motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';

type FilterToggleProps = {
    open: boolean;
    onToggle: () => void;
    activeCount: number;
};

/** "Filters" button for a PageHeader; shows how many filters are currently applied. */
export function FilterToggleButton({ open, onToggle, activeCount }: FilterToggleProps) {
    return (
        <Button variant={open ? 'secondary' : 'outline'} className="relative" onClick={onToggle} aria-expanded={open} aria-controls="filter-panel">
            <SlidersHorizontal className="h-4 w-4" />
            {open ? 'Hide filters' : 'Show filters'}
            {activeCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {activeCount}
                </span>
            )}
        </Button>
    );
}

type FilterPanelProps = {
    open: boolean;
    children: React.ReactNode;
    /** Wrap the contents in a form so Enter submits. */
    onSubmit?: (e: React.FormEvent) => void;
};

/** Animated, collapsible card that holds a page's filter controls. */
export function FilterPanel({ open, children, onSubmit }: FilterPanelProps) {
    const Wrapper = onSubmit ? 'form' : 'div';

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    id="filter-panel"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                >
                    <Wrapper onSubmit={onSubmit} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                        {children}
                    </Wrapper>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
