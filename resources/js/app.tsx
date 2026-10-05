import { createInertiaApp, router } from '@inertiajs/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const fallbackName = import.meta.env.VITE_APP_NAME || 'Laravel';

// The cafe name comes from Settings (shared on every page) so tab titles read "<Cafe name> Kitchen", etc.
let cafeName: string = fallbackName;

const readCafeName = (props: Record<string, unknown> | undefined): string =>
    typeof props?.cafe_name === 'string' && props.cafe_name !== '' ? props.cafe_name : fallbackName;

// Server-rendered titles are built without access to the page props, so swap in the cafe name once the page is live.
const applyCafeName = (): void => {
    if (cafeName === fallbackName) {
        return;
    }

    window.setTimeout(() => {
        if (document.title === fallbackName || document.title.startsWith(`${fallbackName} `)) {
            document.title = cafeName + document.title.slice(fallbackName.length);
        }
    }, 0);
};

if (typeof document !== 'undefined') {
    try {
        const initial = document.querySelector('script[data-page="app"]')?.textContent;

        cafeName = readCafeName(initial ? JSON.parse(initial).props : undefined);
        applyCafeName();
    } catch {
        // keep the fallback name
    }
}

router.on('navigate', (event) => {
    cafeName = readCafeName(event.detail.page.props);
    applyCafeName();
});

createInertiaApp({
    title: (title) => (title ? `${cafeName} ${title}` : cafeName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            // Customer storefront — no layout (standalone mobile page)
            case name.startsWith('Customer/'):
                return null;
            // Kitchen & POS — no layout (full-screen views)
            case name.startsWith('Kitchen/'):
                return null;
            case name.startsWith('POS/'):
                return null;
            // Employee clock in / out screen — standalone full-screen page
            case name.startsWith('Attendance/'):
                return null;
            // Admin — handled by AdminLayout component inside each page
            case name.startsWith('Admin/'):
                return null;
            // Driver app — standalone mobile pages with their own DriverLayout
            case name.startsWith('Driver/'):
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
