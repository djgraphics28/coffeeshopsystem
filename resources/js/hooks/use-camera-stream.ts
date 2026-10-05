import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Starts the camera into a <video> while `active`, stops it afterwards, and explains failures in plain words. */
export function useCameraStream(videoRef: RefObject<HTMLVideoElement | null>, active: boolean, facing: 'user' | 'environment' = 'user') {
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!active) {
            return;
        }

        let stream: MediaStream | null = null;
        let cancelled = false;

        (async () => {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw Object.assign(new Error('insecure'), { name: 'InsecureContext' });
                }

                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });

                if (cancelled || !videoRef.current) {
                    stream.getTracks().forEach((t) => t.stop());

                    return;
                }

                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setError(null);
                setReady(true);
            } catch (e) {
                const name = (e as DOMException).name;

                setReady(false);
                setError(
                    name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser and try again.'
                        : name === 'NotFoundError' ? 'No camera was found on this device.'
                            : name === 'InsecureContext' || !window.isSecureContext ? 'The camera only works on a secure (https) page.'
                                : 'The camera could not be started.',
                );
            }
        })();

        return () => {
            cancelled = true;
            setReady(false);
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [active, facing, videoRef]);

    return { error, ready: active && ready };
}
