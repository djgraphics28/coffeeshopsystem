import { router } from '@inertiajs/react';
import { CheckCircle2, Loader2, ScanFace, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CrudModal } from '@/components/admin/crud-modal';
import { Button } from '@/components/ui/button';
import { useCameraStream } from '@/hooks/use-camera-stream';
import { loadHuman, readFace } from '@/lib/face';
import { adminHrEmployeeFace } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface Props {
    employee: { id: number; full_name: string; face_enrolled: boolean } | null;
    onClose: () => void;
}

const SAMPLES_NEEDED = 5;
/** Pause between automatic captures so each sample is a slightly different pose. */
const CAPTURE_GAP_MS = 1400;

const PROMPTS = [
    'Look straight at the camera',
    'Turn your head slightly to the left',
    'Turn your head slightly to the right',
    'Tilt your chin up a little',
    'Look straight again and smile',
];

/** Captures a few face samples with the camera and stores their descriptors for face attendance. */
export function FaceEnrollDialog({ employee, onClose }: Props) {
    const open = employee !== null;
    const videoRef = useRef<HTMLVideoElement>(null);
    const [modelsReady, setModelsReady] = useState(false);
    const [modelError, setModelError] = useState(false);
    const [samples, setSamples] = useState<number[][]>([]);
    const [hint, setHint] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const { error: cameraError, ready: cameraReady } = useCameraStream(videoRef, open);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;
        loadHuman()
            .then(() => !cancelled && setModelsReady(true))
            .catch(() => !cancelled && setModelError(true));

        return () => {
            cancelled = true;
        };
    }, [open]);

    // Captures a sample automatically each time the face is well framed and live — no button presses needed.
    useEffect(() => {
        if (!open || !cameraReady || !modelsReady || samples.length >= SAMPLES_NEEDED) {
            return;
        }

        let stopped = false;
        let timer = 0;
        let steady = 0;
        const nextAllowedAt = { value: Date.now() + 800 };

        async function loop() {
            const video = videoRef.current;

            try {
                if (video && video.readyState === video.HAVE_ENOUGH_DATA && Date.now() >= nextAllowedAt.value) {
                    const human = await loadHuman();
                    const quick = await readFace(human, video);

                    if (!quick) {
                        steady = 0;
                        setHint('No face found. Face the camera in good light.');
                    } else if (!quick.usable) {
                        steady = 0;
                        setHint(quick.message);
                    } else if (++steady >= 3) {
                        steady = 0;
                        const fresh = await readFace(human, video, true);

                        if (fresh?.usable && fresh.embedding) {
                            const embedding = fresh.embedding;
                            nextAllowedAt.value = Date.now() + CAPTURE_GAP_MS;
                            setHint(null);
                            setSamples((s) => (s.length < SAMPLES_NEEDED ? [...s, embedding] : s));
                        } else if (fresh) {
                            setHint(fresh.message);
                        }
                    }
                }
            } catch {
                // skip a dropped frame
            }

            if (!stopped) {
                timer = window.setTimeout(loop, 120);
            }
        }

        loop();

        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [open, cameraReady, modelsReady, samples.length]);

    function save() {
        if (!employee) {
            return;
        }

        setSaving(true);
        router.post(adminHrEmployeeFace(employee.id), { descriptors: samples } as never, {
            preserveScroll: true,
            onSuccess: onClose,
            onFinish: () => setSaving(false),
        });
    }

    function remove() {
        if (!employee || !window.confirm(`Remove ${employee.full_name}'s face data? They will need to use their ID or QR code.`)) {
            return;
        }

        router.delete(adminHrEmployeeFace(employee.id), { preserveScroll: true, onSuccess: onClose });
    }

    const done = samples.length >= SAMPLES_NEEDED;
    const status = cameraError ?? (modelError ? 'Could not load the face recognition models.' : !modelsReady ? 'Loading face recognition…' : null);

    return (
        <CrudModal
            open={open}
            onOpenChange={(v) => !v && onClose()}
            title={`Face attendance — ${employee?.full_name ?? ''}`}
            description="Look at the camera and follow the prompts. Photos are taken automatically; only a numeric signature is stored, never the photos."
            footer={
                <>
                    {employee?.face_enrolled && (
                        <Button type="button" variant="outline" onClick={remove} className="mr-auto text-error"><Trash2 className="h-4 w-4" /> Remove face</Button>
                    )}
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="button" onClick={save} disabled={samples.length < 3 || saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save face ({samples.length}/{SAMPLES_NEEDED})
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="relative overflow-hidden rounded-xl bg-black">
                    <video ref={videoRef} playsInline muted className="aspect-video w-full -scale-x-100 object-cover" />
                    {status && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white">
                            {!cameraError && !modelError && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{status}
                        </div>
                    )}
                    {cameraReady && modelsReady && (
                        <p className="absolute bottom-2 left-0 w-full text-center text-xs font-semibold text-white drop-shadow">{done ? 'All set — save the face' : PROMPTS[samples.length]}</p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-1.5" aria-label={`${samples.length} of ${SAMPLES_NEEDED} photos captured`}>
                        {Array.from({ length: SAMPLES_NEEDED }, (_, i) => (
                            <span key={i} className={cn('h-2.5 w-8 rounded-full', i < samples.length ? 'bg-success' : 'bg-muted')} />
                        ))}
                    </div>
                    {samples.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => setSamples([])}>Start over</Button>}
                </div>

                {hint && <p role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">{hint}</p>}
                {employee?.face_enrolled && samples.length === 0 && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ScanFace className="h-4 w-4 text-success" /> A face is already registered. Scanning again replaces it.</p>
                )}
            </div>
        </CrudModal>
    );
}
