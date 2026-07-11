import { Link, usePage } from '@inertiajs/react';
import { ClipboardList, Coffee, ReceiptText, UserRound } from 'lucide-react';

/* Retro-geometric palette shared with the storefront */
const P = {
    navy: '#232B4A',
    terracotta: '#C05B2D',
    cream: '#E4DACB',
};

interface ActiveOrder {
    id: number;
    order_number: string;
    status: string;
}

interface CustomerAuthProps {
    customer_auth?: {
        customer: { id: number } | null;
        active_order: ActiveOrder | null;
    };
}

/**
 * Fixed bottom navigation for customer-facing pages:
 * Menu · Track (active order) · Orders · Profile
 */
export default function CustomerNav({ current }: { current: 'menu' | 'track' | 'orders' | 'profile' }) {
    const { customer_auth } = usePage().props as CustomerAuthProps;
    const activeOrder = customer_auth?.active_order ?? null;

    const tabs = [
        { key: 'menu', label: 'Menu', href: '/order', icon: Coffee },
        {
            key: 'track',
            label: 'Track',
            href: activeOrder ? `/order/track/${activeOrder.id}` : null,
            icon: ClipboardList,
            pulse: !!activeOrder,
        },
        { key: 'orders', label: 'Orders', href: '/order/my/orders', icon: ReceiptText },
        { key: 'profile', label: 'Profile', href: '/order/my/profile', icon: UserRound },
    ] as const;

    return (
        <nav
            className="fixed bottom-0 left-0 right-0"
            style={{ background: P.navy, zIndex: 55, boxShadow: '0 -4px 16px rgba(0,0,0,0.25)' }}
        >
            <div className="mx-auto flex max-w-md items-stretch justify-around">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = current === tab.key;
                    const disabled = tab.href === null;

                    const inner = (
                        <>
                            <span className="relative">
                                <Icon className="h-5 w-5" />
                                {'pulse' in tab && tab.pulse && !isActive && (
                                    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: P.terracotta }} />
                                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: P.terracotta }} />
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wide">{tab.label}</span>
                        </>
                    );

                    const style = {
                        color: isActive ? P.terracotta : disabled ? 'rgba(255,255,255,0.3)' : P.cream,
                        borderTop: `3px solid ${isActive ? P.terracotta : 'transparent'}`,
                    };

                    return disabled ? (
                        <span key={tab.key} className="flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2" style={style} title="No active order">
                            {inner}
                        </span>
                    ) : (
                        <Link key={tab.key} href={tab.href!} className="flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2 transition-colors" style={style}>
                            {inner}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
