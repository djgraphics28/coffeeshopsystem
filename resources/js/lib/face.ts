/**
 * Browser-side face recognition (runs fully on the device — only a 128-number descriptor is ever sent to the server).
 * face-api and its models are loaded on demand so they don't weigh down the rest of the app.
 */
import type * as FaceApiModule from '@vladmandic/face-api';

export type FaceApi = typeof FaceApiModule;

const MODEL_URL = '/models/face';

let loading: Promise<FaceApi> | null = null;

export function loadFaceApi(): Promise<FaceApi> {
    loading ??= (async () => {
        const faceapi = await import('@vladmandic/face-api');

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        return faceapi;
    })().catch((error) => {
        loading = null;

        throw error;
    });

    return loading;
}

export interface FaceReading {
    descriptor: number[];
    /** Face width as a share of the frame width, so callers can ask the person to move closer. */
    size: number;
    /** Eye aspect ratio — drops sharply while the eyes are closed (used as a blink / liveness check). */
    eyeRatio: number;
}

type Point = { x: number; y: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function eyeAspectRatio(eye: Point[]): number {
    return (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / (2 * distance(eye[0], eye[3]));
}

/**
 * Reads the single most prominent face in the frame, or null when there is none.
 * Only computes the (heavier) descriptor when asked to.
 */
export async function readFace(faceapi: FaceApi, source: HTMLVideoElement, withDescriptor: boolean): Promise<FaceReading | null> {
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const detection = faceapi.detectSingleFace(source, options).withFaceLandmarks();
    const result = withDescriptor ? await detection.withFaceDescriptor() : await detection;

    if (!result) {
        return null;
    }

    const points = result.landmarks.positions;
    const eyeRatio = (eyeAspectRatio(points.slice(36, 42)) + eyeAspectRatio(points.slice(42, 48))) / 2;

    return {
        descriptor: withDescriptor && 'descriptor' in result ? Array.from(result.descriptor as Float32Array) : [],
        size: result.detection.box.width / (source.videoWidth || 1),
        eyeRatio,
    };
}

export const EYES_CLOSED_BELOW = 0.2;
export const EYES_OPEN_ABOVE = 0.25;
