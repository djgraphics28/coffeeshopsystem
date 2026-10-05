/**
 * Browser-side face recognition built on Human (BlazeFace detection, 468-point mesh with iris tracking, a 1024-number
 * face embedding, and passive anti-spoofing / liveness models). Everything runs on the device — only the embedding
 * is ever sent to the server. Human and its models are loaded on demand so they don't weigh down the rest of the app.
 */
import type { Human } from '@vladmandic/human';

export type { Human };

export const DESCRIPTOR_SIZE = 1024;

/** Smallest face (share of the frame width) we accept, so people have to step up to the screen. */
export const MIN_FACE_SIZE = 0.2;
/** Largest head turn (radians) that still gives a reliable embedding. */
const MAX_TURN = 0.45;
const MIN_REAL = 0.55;
const MIN_LIVE = 0.55;

let loading: Promise<Human> | null = null;

export function loadHuman(): Promise<Human> {
    loading ??= (async () => {
        const { Human: HumanEngine } = await import('@vladmandic/human');
        const human = new HumanEngine({
            backend: 'webgl',
            modelBasePath: '/models/human/',
            debug: false,
            async: true,
            warmup: 'none',
            cacheSensitivity: 0.7,
            filter: { enabled: true, equalization: false },
            face: {
                enabled: true,
                detector: { rotation: false, maxDetected: 1, minConfidence: 0.5 },
                mesh: { enabled: true },
                iris: { enabled: true },
                description: { enabled: true },
                antispoof: { enabled: true },
                liveness: { enabled: true },
                emotion: { enabled: false },
                attention: { enabled: false },
            },
            body: { enabled: false },
            hand: { enabled: false },
            object: { enabled: false },
            gesture: { enabled: false },
            segmentation: { enabled: false },
        });

        await human.load();
        await human.warmup();

        return human;
    })().catch((error) => {
        loading = null;

        throw error;
    });

    return loading;
}

export interface FaceReading {
    /** Whether this frame is good enough to recognise (right size, facing the camera, confident detection). */
    usable: boolean;
    /** Plain-words guidance for the person standing at the camera. */
    message: string;
    /** Face width as a share of the frame width. */
    size: number;
    /** Photo / screen detection scores (only meaningful on a fresh reading). */
    real: number | null;
    live: number | null;
    embedding: number[] | null;
}

/**
 * Looks at the current video frame. Quick readings reuse Human's tracking cache and are cheap; a `fresh` reading
 * recomputes the embedding and the anti-spoofing checks from this exact frame, which is what we send to the server.
 */
export async function readFace(human: Human, video: HTMLVideoElement, fresh = false): Promise<FaceReading | null> {
    const result = await human.detect(
        video,
        fresh
            ? {
                face: {
                    description: { skipFrames: 0, skipTime: 0 },
                    antispoof: { skipFrames: 0, skipTime: 0 },
                    liveness: { skipFrames: 0, skipTime: 0 },
                },
            }
            : undefined,
    );

    if (result.face.length === 0) {
        return null;
    }

    const face = result.face[0];
    const size = face.box[2] / (video.videoWidth || 1);
    const yaw = Math.abs(face.rotation?.angle.yaw ?? 0);
    const pitch = Math.abs(face.rotation?.angle.pitch ?? 0);
    const real = face.real ?? null;
    const live = face.live ?? null;

    let message = '';

    if (face.faceScore < 0.7 || face.boxScore < 0.6) {
        message = 'Face the camera in good light.';
    } else if (size < MIN_FACE_SIZE) {
        message = 'Move a little closer.';
    } else if (yaw > MAX_TURN || pitch > MAX_TURN) {
        message = 'Look straight at the camera.';
    } else if (fresh && ((real !== null && real < MIN_REAL) || (live !== null && live < MIN_LIVE))) {
        message = 'Could not confirm a live face. Please look at the camera directly.';
    } else if (fresh && (!face.embedding || face.embedding.length !== DESCRIPTOR_SIZE)) {
        message = 'Hold still for a moment.';
    }

    return { usable: message === '', message, size, real, live, embedding: fresh ? (face.embedding ?? null) : null };
}
