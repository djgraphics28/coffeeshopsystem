import { router } from '@inertiajs/react';
import { LogOut, RefreshCw } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { logout } from '@/lib/routes';

/* Retro-geometric palette shared with the customer pages */
export const DRIVER_PALETTE = {
    cream: '#E4DACB',
    creamLight: '#EFE8DC',
    navy: '#232B4A',
    terracotta: '#C05B2D',
    caramel: '#B5824F',
    espresso: '#3B2A1D',
    sand: '#D8CBB8',
    green: '#5B8A4E',
};

const P = DRIVER_PALETTE;

interface Props {
    deliveryMan?: { name: string; vehicle: string | null } | null;
    children: React.ReactNode;
}

/**
 * Mobile-first layout for driver app pages: sticky navy header with the
 * rider's identity, refresh, and sign-out.
 */
export default function DriverLayout({ deliveryMan, children }: Props) {
    return (
        <div className="customer-page min-h-screen pb-10" style={{ background: P.cream, fontFamily: "'DM Sans', sans-serif", color: P.espresso }}>
            <Toaster position="top-center" />

            {/* Header */}
            <div className="sticky top-0 z-30 shadow-md" style={{ background: P.navy }}>
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-lg" style={{ background: P.terracotta }}>
                        🛵
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: P.sand }}>Driver App</p>
                        <p className="truncate font-black uppercase tracking-tight text-white">
                            {deliveryMan?.name ?? 'No rider profile'}
                            {deliveryMan?.vehicle && <span className="ml-2 text-[10px] font-semibold normal-case" style={{ color: P.sand }}>{deliveryMan.vehicle}</span>}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => router.reload()} className="rounded-full p-2 text-white/70 hover:text-white" title="Refresh">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button onClick={() => router.post(logout())} className="rounded-full p-2 text-white/70 hover:text-white" title="Sign out">
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-2xl px-4 py-5">{children}</div>
        </div>
    );
}
