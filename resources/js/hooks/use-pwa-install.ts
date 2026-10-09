import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = (): boolean =>
    typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const isIos = (): boolean => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Lets a screen offer "Install app". Chrome, Edge and Android hand us an install prompt; iOS Safari has none,
 * so there the caller shows the "Add to Home Screen" steps instead.
 */
export function usePwaInstall() {
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isStandalone);

    useEffect(() => {
        const onPrompt = (event: Event) => {
            event.preventDefault();
            setPromptEvent(event as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setInstalled(true);
            setPromptEvent(null);
        };

        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const install = useCallback(async () => {
        if (!promptEvent) {
            return;
        }

        await promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
    }, [promptEvent]);

    return {
        /** The browser can show its own install dialog right now. */
        canInstall: !installed && promptEvent !== null,
        /** iOS Safari: installing is manual (Share → Add to Home Screen). */
        showIosSteps: !installed && isIos(),
        installed,
        install,
    };
}
