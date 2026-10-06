import { Head } from '@inertiajs/react';
import jsQR from 'jsqr';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Clock, LogIn, LogOut, Loader2, ScanFace, ScanLine, SwitchCamera } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraStream } from '@/hooks/use-camera-stream';
import { loadHuman, readFace } from '@/lib/face';
import { attendanceFace, attendancePunch } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface RecentPunch { name: string; type: 'in' | 'out'; time: string }
interface PunchResult {
    type: 'in' | 'out';
    employee: { name: string; code: string; position: string | null };
    time: string;
    worked_minutes: number | null;
    late_minutes: number;
    message: string;
    recent: RecentPunch[];
}

interface Props {
    enabled: boolean;
    timezone: string;
    cafe_name: string;
    face_enabled: boolean;
    recent: RecentPunch[];
}

type Outcome = { kind: 'success'; result: PunchResult } | { kind: 'error'; message: string } | null;

const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
const RESULT_SECONDS = 6;
/** After any camera read, ignore the same code briefly; after a successful punch, ignore it longer so a card held up isn't scanned again. */
const SCAN_COOLDOWN_MS = 4000;
const SUCCESS_COOLDOWN_MS = 15000;

const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
const clock = (iso: string, timeZone: string) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone });

export default function Kiosk({ enabled, timezone, cafe_name, face_enabled, recent: initialRecent }: Props) {
    const [now, setNow] = useState(() => new Date());
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<Outcome>(null);
    const [recent, setRecent] = useState<RecentPunch[]>(initialRecent);
    const [cameraOn, setCameraOn] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [facing, setFacing] = useState<'user' | 'environment'>('user');
    const [mode, setMode] = useState<'qr' | 'face'>(face_enabled ? 'face' : 'qr');

    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastScan = useRef<{ code: string; until: number }>({ code: '', until: 0 });
    const busyRef = useRef(false);
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
 inputRef.current?.focus(); 
}, [enabled]);

    /** Sends a punch (by ID/QR code or by face) and shows the outcome. Resolves true when the punch was recorded. */
    const punch = useCallback(async (url: string, body: Record<string, unknown>, cooldownKey: string): Promise<boolean> => {
        if (busyRef.current) {
            return false;
        }

        busyRef.current = true;
        setBusy(true);

        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
        }

        let recorded = false;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => null);

            if (res.ok) {
                recorded = true;
                lastScan.current = { code: cooldownKey, until: Date.now() + SUCCESS_COOLDOWN_MS };
                setOutcome({ kind: 'success', result: data });
                setRecent(data.recent ?? []);
            } else {
                const message = data?.errors?.code?.[0] ?? data?.errors?.descriptor?.[0] ?? data?.message ?? (res.status === 429 ? 'Too many tries. Please wait a moment.' : 'Something went wrong. Please try again.');
                setOutcome({ kind: 'error', message });
            }
        } catch {
            setOutcome({ kind: 'error', message: 'No connection. Please check the network and try again.' });
        } finally {
            busyRef.current = false;
            setBusy(false);
            setCode('');
            inputRef.current?.focus();
            dismissTimer.current = setTimeout(() => setOutcome(null), RESULT_SECONDS * 1000);
        }

        return recorded;
    }, []);

    const submit = useCallback((value: string) => {
        const trimmed = value.trim();

        return trimmed ? punch(attendancePunch(), { code: trimmed }, trimmed) : Promise.resolve(false);
    }, [punch]);

    // ── Face recognition ──
    const faceActive = cameraOn && mode === 'face' && enabled;
    const { error: faceCameraError, ready: faceCameraReady } = useCameraStream(videoRef, faceActive);
    const [faceStatus, setFaceStatus] = useState('Loading face recognition…');
    const [faceModelsReady, setFaceModelsReady] = useState(false);

    useEffect(() => {
        if (!faceActive || faceModelsReady) {
            return;
        }

        loadHuman().then(() => setFaceModelsReady(true)).catch(() => setFaceStatus('Could not load face recognition. Use your employee ID instead.'));
    }, [faceActive, faceModelsReady]);

    useEffect(() => {
        if (!faceActive || !faceCameraReady || !faceModelsReady) {
            return;
        }

        let stopped = false;
        let timer = 0;
        let steadyFrames = 0;
        let lastFaceAt = Date.now();
        let armed = true;
        let rearmAt = 0;

        async function loop() {
            const video = videoRef.current;

            try {
                if (video && video.readyState === video.HAVE_ENOUGH_DATA && !busyRef.current) {
                    const human = await loadHuman();
                    const quick = await readFace(human, video);
                    const nowMs = Date.now();

                    if (!quick) {
                        steadyFrames = 0;

                        if (nowMs - lastFaceAt > 3000) {
                            armed = true; // the previous person has walked away
                        }

                        setFaceStatus(armed ? 'Looking for a face…' : 'Thanks! Step away to clock the next person.');
                    } else {
                        lastFaceAt = nowMs;

                        if (!armed || nowMs < rearmAt) {
                            steadyFrames = 0;
                            setFaceStatus('Thanks! Step away to clock the next person.');
                        } else if (!quick.usable) {
                            steadyFrames = 0;
                            setFaceStatus(quick.message);
                        } else if (++steadyFrames < 3) {
                            setFaceStatus('Hold still…');
                        } else {
                            // A steady, well-framed face: take a fresh reading (new embedding + live-person checks) and clock it.
                            steadyFrames = 0;
                            setFaceStatus('Recognising…');
                            const fresh = await readFace(human, video, true);

                            if (fresh?.usable && fresh.embedding) {
                                const recorded = await punch(attendanceFace(), { descriptor: fresh.embedding }, 'face');

                                if (recorded) {
                                    armed = false;
                                } else {
                                    rearmAt = Date.now() + 4000;
                                }
                            } else if (fresh) {
                                setFaceStatus(fresh.message);
                                rearmAt = Date.now() + 1500;
                            }
                        }
                    }
                }
            } catch {
                // a dropped frame is fine; try again on the next tick
            }

            if (!stopped) {
                timer = window.setTimeout(loop, 90);
            }
        }

        loop();

        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [faceActive, faceCameraReady, faceModelsReady, punch]);

    // ── Camera QR scanning ──
    useEffect(() => {
        if (!cameraOn || !enabled || mode !== 'qr') {
 return; 
}

        let stream: MediaStream | null = null;
        let frame = 0;
        let cancelled = false;

        async function start() {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });

                if (cancelled || !videoRef.current) {
 stream.getTracks().forEach((t) => t.stop());

 return; 
}

                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraError(null);
                tick();
            } catch (e) {
                const name = (e as DOMException).name;
                setCameraOn(false);
                setCameraError(
                    name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in the browser, or type the employee ID instead.'
                        : name === 'NotFoundError' ? 'No camera was found on this device. Type the employee ID instead.'
                            : !window.isSecureContext ? 'The camera only works on a secure (https) page. Type the employee ID instead.'
                                : 'The camera could not be started. Type the employee ID instead.',
                );
            }
        }

        function tick() {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                const w = 480;
                const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                if (ctx) {
                    ctx.drawImage(video, 0, 0, w, h);
                    const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
                    const nowMs = Date.now();

                    if (found?.data && !(found.data === lastScan.current.code && nowMs < lastScan.current.until) && !busyRef.current) {
                        lastScan.current = { code: found.data, until: nowMs + SCAN_COOLDOWN_MS };
                        submit(found.data);
                    }
                }
            }

            frame = window.setTimeout(tick, 150);
        }

        start();

        return () => {
            cancelled = true;
            clearTimeout(frame);
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, [cameraOn, facing, enabled, mode, submit]);

    const success = outcome?.kind === 'success' ? outcome.result : null;

    return (
        <div className="admin-panel min-h-screen bg-[var(--ap-bg)] text-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Head title="Attendance" />

            <header className="flex items-center justify-between gap-4 bg-primary px-6 py-4 text-primary-foreground">
                <div>
                    <p className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{cafe_name}</p>
                    <p className="text-xs opacity-80">Employee attendance</p>
                </div>
                <div className="text-right">
                    <p className="text-3xl leading-none font-bold tabular-nums sm:text-4xl" style={{ fontFamily: "'Space Mono', monospace" }}>
                        {now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: timezone })}
                    </p>
                    <p className="mt-1 text-xs opacity-80">{now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone })}</p>
                </div>
            </header>

            {!enabled ? (
                <main className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
                    <AlertTriangle className="mb-4 h-14 w-14 text-warning" />
                    <h1 className="text-xl font-bold">Attendance is switched off</h1>
                    <p className="mt-2 text-sm text-muted-foreground">Clocking in and out is not available right now. Please see your manager.</p>
                </main>
            ) : (
                <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-5">
                    {/* Result / scan area */}
                    <section className="lg:col-span-3">
                        <div aria-live="polite" className="mb-4 min-h-[148px]">
                            {success && (
                                <div className={cn('flex items-center gap-4 rounded-2xl p-5 text-white shadow-lg', success.type === 'in' ? 'bg-success' : 'bg-info')}>
                                    {success.type === 'in' ? <LogIn className="h-14 w-14 shrink-0" /> : <LogOut className="h-14 w-14 shrink-0" />}
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold tracking-widest uppercase opacity-90">{success.type === 'in' ? 'Clocked in' : 'Clocked out'}</p>
                                        <p className="truncate text-2xl font-bold">{success.employee.name}</p>
                                        <p className="text-sm opacity-90">{success.employee.position ?? success.employee.code} · {clock(success.time, timezone)}</p>
                                        <p className="mt-1 text-sm font-medium">{success.message}</p>
                                    </div>
                                </div>
                            )}
                            {outcome?.kind === 'error' && (
                                <div role="alert" className="flex items-center gap-4 rounded-2xl bg-error p-5 text-white shadow-lg">
                                    <AlertTriangle className="h-12 w-12 shrink-0" />
                                    <p className="text-lg font-semibold">{outcome.message}</p>
                                </div>
                            )}
                            {!outcome && (
                                <div className="flex h-full min-h-[148px] items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--ap-border)] bg-card p-5 text-muted-foreground">
                                    <ScanLine className="h-12 w-12 shrink-0 opacity-50" />
                                    <div>
                                        <p className="text-lg font-semibold text-foreground">Ready</p>
                                        <p className="text-sm">Scan your QR code, show your face to the camera, or type your employee ID.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form className="rounded-2xl border border-[var(--ap-border)] bg-card p-5 shadow-sm" onSubmit={(e) => {
 e.preventDefault(); submit(code); 
}}>
                            <label htmlFor="employee-code" className="mb-2 block text-sm font-semibold">Employee ID</label>
                            <div className="flex gap-2">
                                <input
                                    id="employee-code" ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
                                    placeholder="EMP-0001" disabled={busy}
                                    className="h-14 min-w-0 flex-1 rounded-xl border border-[var(--ap-input-border)] bg-transparent px-4 text-xl font-bold tracking-wider uppercase outline-none focus:border-primary focus:ring-3 focus:ring-primary/10"
                                    style={{ fontFamily: "'Space Mono', monospace" }}
                                />
                                <button type="submit" disabled={busy || !code.trim()} className="flex h-14 min-w-32 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground transition-opacity disabled:opacity-50">
                                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />} Clock In / Out
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">Your first scan or entry of the day clocks you in; the next one clocks you out. A handheld barcode scanner works here too.</p>
                        </form>

                        <div className="mt-4 rounded-2xl border border-[var(--ap-border)] bg-card p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                {face_enabled ? (
                                    <div role="tablist" className="flex rounded-lg bg-muted p-1 text-xs font-semibold">
                                        {([['face', 'Face', ScanFace], ['qr', 'QR code', Camera]] as const).map(([key, label, Icon]) => (
                                            <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5', mode === key ? 'bg-card shadow-sm' : 'text-muted-foreground')}>
                                                <Icon className="h-3.5 w-3.5" /> {label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="flex items-center gap-2 text-sm font-semibold"><Camera className="h-4 w-4 text-primary" /> Scan with camera</p>
                                )}
                                <div className="flex gap-2">
                                    {cameraOn && mode === 'qr' && (
                                        <button type="button" onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ap-border)] px-3 text-xs font-medium hover:bg-muted" aria-label="Switch camera">
                                            <SwitchCamera className="h-4 w-4" /> Flip
                                        </button>
                                    )}
                                    <button type="button" onClick={() => {
 setCameraError(null); setCameraOn((v) => !v); 
}} className={cn('flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold', cameraOn ? 'bg-error/10 text-error' : 'bg-primary text-primary-foreground')}>
                                        {cameraOn ? <><CameraOff className="h-4 w-4" /> Stop camera</> : <><Camera className="h-4 w-4" /> Start camera</>}
                                    </button>
                                </div>
                            </div>
                            {(cameraError || (mode === 'face' && faceCameraError)) && <p role="alert" className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">{mode === 'face' ? faceCameraError ?? cameraError : cameraError}</p>}
                            {cameraOn && (
                                <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
                                    <video ref={videoRef} playsInline muted className={cn('aspect-video w-full object-cover', (mode === 'face' || facing === 'user') && '-scale-x-100')} />
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                        <div className={cn('border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]', mode === 'face' ? 'h-56 w-44 rounded-[50%]' : 'h-48 w-48 rounded-2xl')} />
                                    </div>
                                    <p className="absolute bottom-2 left-0 w-full text-center text-xs font-medium text-white">{mode === 'face' ? faceStatus : 'Hold your QR code inside the square'}</p>
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Recent */}
                    <aside className="lg:col-span-2">
                        <div className="rounded-2xl border border-[var(--ap-border)] bg-card p-5 shadow-sm">
                            <h2 className="mb-3 text-sm font-semibold">Today's activity</h2>
                            {recent.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No one has clocked in yet today.</p>
                            ) : (
                                <ul className="divide-y divide-[var(--ap-border)]">
                                    {recent.map((r, i) => (
                                        <li key={`${r.name}-${r.time}-${i}`} className="flex items-center gap-3 py-2.5">
                                            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', r.type === 'in' ? 'bg-success/10 text-success' : 'bg-info/10 text-info')}>
                                                {r.type === 'in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold">{r.name}</p>
                                                <p className="text-xs text-muted-foreground">{r.type === 'in' ? 'Clocked in' : 'Clocked out'}</p>
                                            </div>
                                            <span className="text-xs font-medium text-muted-foreground tabular-nums">{clock(r.time, timezone)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {success?.type === 'out' && success.worked_minutes !== null && (
                            <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Worked {duration(success.worked_minutes)} today</p>
                        )}
                    </aside>
                </main>
            )}
        </div>
    );
}
