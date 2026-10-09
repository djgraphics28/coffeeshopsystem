import { Download, MoreVertical, Share } from 'lucide-react';
import { useState } from 'react';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { cn } from '@/lib/utils';

/**
 * "Install app" button. When the browser offers its install dialog it opens that; otherwise it shows the manual
 * steps for this device, so the button is always there until the app is installed.
 */
export function InstallAppButton({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'onPrimary' }) {
    const { canInstall, showIosSteps, installed, install } = usePwaInstall();
    const [open, setOpen] = useState(false);

    if (installed) {
        return null;
    }

    const secure = typeof window === 'undefined' || window.isSecureContext;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={canInstall ? install : () => setOpen((v) => !v)}
                aria-expanded={canInstall ? undefined : open}
                title="Install the app on this device"
                className={cn(
                    'flex h-9 items-center gap-2 rounded-xl px-2.5 text-sm font-medium transition-colors',
                    tone === 'onPrimary' ? 'text-primary-foreground hover:bg-white/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    className,
                )}
            >
                <Download className="h-[18px] w-[18px]" />
                <span className="hidden sm:inline">Install app</span>
            </button>
            {open && (
                <div role="status" className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-3 text-xs text-foreground shadow-lg">
                    <p className="mb-1.5 text-sm font-semibold">Install this app</p>
                    {!secure ? (
                        <p className="text-muted-foreground">This page is not on a secure (HTTPS) address, so the browser will not allow installing. Open the site through its <b className="text-foreground">https://</b> address.</p>
                    ) : showIosSteps ? (
                        <p className="flex flex-wrap items-center gap-1 text-muted-foreground">In Safari, tap <Share className="inline h-3.5 w-3.5" /> <b className="text-foreground">Share</b>, then <b className="text-foreground">Add to Home Screen</b>.</p>
                    ) : (
                        <ul className="space-y-1.5 text-muted-foreground">
                            <li className="flex flex-wrap items-center gap-1"><b className="text-foreground">Chrome / Edge:</b> open the <MoreVertical className="inline h-3.5 w-3.5" /> menu, then <b className="text-foreground">Install app</b> (or <b className="text-foreground">Add to Home screen</b> on Android).</li>
                            <li>On a computer you can also click the install icon at the right end of the address bar.</li>
                            <li>If you do not see it, reload the page once and try again.</li>
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
