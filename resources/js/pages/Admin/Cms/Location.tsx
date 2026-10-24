import { Head, useForm, usePage } from '@inertiajs/react';
import type { LatLngTuple, Map as LeafletMap, Marker } from 'leaflet';
import { Crosshair, ExternalLink, Loader2, MapPin, MapPinned, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminCmsLocationUpdate } from '@/lib/routes';

interface Props {
    location: { address: string | null; map_lat: string | null; map_lng: string | null; map_url: string | null };
    frontend_url: string;
}

type SearchResult = { place_id: number; display_name: string; lat: string; lon: string };

/** Where the map opens before a pin is set (Metro Manila). */
const DEFAULT_CENTER: LatLngTuple = [14.5995, 120.9842];
const NOMINATIM = 'https://nominatim.openstreetmap.org';

function toCoordinate(value: number): string {
    return value.toFixed(6);
}

function parsePin(lat: string, lng: string): LatLngTuple | null {
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (lat === '' || lng === '' || Number.isNaN(latitude) || Number.isNaN(longitude)) {
        return null;
    }

    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? [latitude, longitude] : null;
}

export default function LocationPage({ location, frontend_url }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };
    const { data, setData, put, processing, errors } = useForm({
        address: location.address ?? '',
        map_lat: location.map_lat ?? '',
        map_lng: location.map_lng ?? '',
        map_url: location.map_url ?? '',
    });

    const mapElement = useRef<HTMLDivElement>(null);
    const mapRef = useRef<LeafletMap | null>(null);
    const markerRef = useRef<Marker | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [filling, setFilling] = useState(false);

    const pin = parsePin(data.map_lat, data.map_lng);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    function placePin(lat: number, lng: number) {
        setData((prev) => ({ ...prev, map_lat: toCoordinate(lat), map_lng: toCoordinate(lng) }));
    }

    // Leaflet handlers are bound once; route them through a ref so they always use the latest setter.
    const placePinRef = useRef(placePin);

    useEffect(() => {
        placePinRef.current = placePin;
    });

    // Create the Leaflet map once (loaded on demand so it never runs during SSR).
    useEffect(() => {
        let cancelled = false;

        import('leaflet').then((L) => {
            if (cancelled || !mapElement.current || mapRef.current) {
                return;
            }

            const initial = parsePin(location.map_lat ?? '', location.map_lng ?? '');
            const map = L.map(mapElement.current, { scrollWheelZoom: true }).setView(initial ?? DEFAULT_CENTER, initial ? 17 : 12);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }).addTo(map);

            const icon = L.divIcon({
                className: '',
                html: '<div style="width:44px;height:44px;border-radius:9999px 9999px 9999px 0;transform:rotate(-45deg);background:#f2a93b;border:3px solid #24150d;display:grid;place-items:center;box-shadow:0 8px 20px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);font-size:20px">☕</span></div>',
                iconSize: [44, 44],
                iconAnchor: [4, 44],
            });

            const marker = L.marker(initial ?? DEFAULT_CENTER, { draggable: true, icon });

            if (initial) {
                marker.addTo(map);
            }

            marker.on('dragend', () => {
                const { lat, lng } = marker.getLatLng();
                placePinRef.current(lat, lng);
            });

            map.on('click', (event) => placePinRef.current(event.latlng.lat, event.latlng.lng));

            mapRef.current = map;
            markerRef.current = marker;
            setMapReady(true);
        });

        return () => {
            cancelled = true;
            mapRef.current?.remove();
            mapRef.current = null;
            markerRef.current = null;
        };
        // The map is created once; later pin changes are synced by the effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the marker in step with the form (map clicks, drags, search, typed coordinates).
    useEffect(() => {
        const map = mapRef.current;
        const marker = markerRef.current;

        if (!map || !marker) {
            return;
        }

        if (!pin) {
            marker.remove();

            return;
        }

        marker.setLatLng(pin);

        if (!map.hasLayer(marker)) {
            marker.addTo(map);
        }

        if (!map.getBounds().pad(-0.2).contains(pin)) {
            map.panTo(pin);
        }
    }, [pin?.[0], pin?.[1], mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

    function flyTo(lat: number, lng: number) {
        placePin(lat, lng);
        mapRef.current?.flyTo([lat, lng], 17, { duration: 0.8 });
    }

    async function search(e?: React.FormEvent) {
        e?.preventDefault();

        if (!query.trim()) {
            return;
        }

        setSearching(true);

        try {
            const response = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json' },
            });
            const found: SearchResult[] = await response.json();
            setResults(found);

            if (found.length === 1) {
                pickResult(found[0]);
            }
        } catch {
            toast.error('Search is unavailable right now — click the map to place the pin instead.');
        } finally {
            setSearching(false);
        }
    }

    function pickResult(result: SearchResult) {
        flyTo(Number(result.lat), Number(result.lon));
        setResults(null);

        if (!data.address) {
            setData('address', result.display_name);
        }
    }

    function useCurrentLocation() {
        if (!navigator.geolocation) {
            toast.error('Location is not available in this browser.');

            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                flyTo(position.coords.latitude, position.coords.longitude);
                toast.success('Pinned your current location.');
            },
            () => {
                setLocating(false);
                toast.error('Could not get your location — allow location access, or search / click the map.');
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }

    async function fillAddressFromPin() {
        if (!pin) {
            return;
        }

        setFilling(true);

        try {
            const response = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${pin[0]}&lon=${pin[1]}`, { headers: { Accept: 'application/json' } });
            const place: { display_name?: string } = await response.json();

            if (place.display_name) {
                setData('address', place.display_name);
            } else {
                toast.error('No address found for this spot — type it in.');
            }
        } catch {
            toast.error('Address lookup is unavailable right now.');
        } finally {
            setFilling(false);
        }
    }

    /** Typed or pasted coordinates — a "14.6406, 121.066" pair (as copied from Google Maps) fills both. */
    function setCoordinate(field: 'map_lat' | 'map_lng', value: string) {
        const pair = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);

        if (pair) {
            setData((prev) => ({ ...prev, map_lat: pair[1], map_lng: pair[2] }));

            return;
        }

        setData(field, value);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        put(adminCmsLocationUpdate(), { preserveScroll: true });
    }

    const googlePreview = pin
        ? `https://maps.google.com/maps?q=${pin[0]},${pin[1]}&z=17&output=embed`
        : data.address
          ? `https://maps.google.com/maps?q=${encodeURIComponent(data.address)}&z=16&output=embed`
          : null;

    return (
        <AdminLayout>
            <Head title="Location" />
            <Toaster position="top-right" />
            <div className="max-w-5xl">
                <PageHeader
                    title="Café Location"
                    breadcrumbs={[{ label: 'CMS' }, { label: 'Location' }]}
                    actions={
                        <a href={`${frontend_url}/#visit`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                            View on website <ExternalLink className="h-4 w-4" />
                        </a>
                    }
                />
                <p className="-mt-3 mb-6 text-sm text-muted-foreground">
                    Where customers find you. The pin is shown as a map with &ldquo;Get directions&rdquo; on the website&apos;s Visit us section.
                </p>

                <form onSubmit={submit} className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            void search(e);
                                        }
                                    }}
                                    placeholder="Search a street, landmark or barangay…"
                                    className={adminFieldClass() + ' pl-9'}
                                />
                                {results && (
                                    <ul className="absolute inset-x-0 top-full z-[1000] mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                                        {results.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No places found — try another search or click the map.</li>}
                                        {results.map((result) => (
                                            <li key={result.place_id}>
                                                <button type="button" onClick={() => pickResult(result)} className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-muted">
                                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                                    {result.display_name}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
                                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
                                </Button>
                                <Button type="button" variant="outline" onClick={useCurrentLocation} disabled={locating}>
                                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} My location
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <div ref={mapElement} className="h-[26rem] w-full bg-muted" role="application" aria-label="Map — click to place the café pin" />
                            {!pin && mapReady && (
                                <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex justify-center">
                                    <span className="rounded-full bg-black/70 px-4 py-2 text-xs font-medium text-white shadow-lg">Click the map to drop your café pin</span>
                                </div>
                            )}
                        </div>
                        <p className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                            <MapPinned className="h-3.5 w-3.5" /> Click anywhere to move the pin, or drag it. Zoom in for an exact spot.
                        </p>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Latitude" error={errors.map_lat}>
                                    <input inputMode="decimal" value={data.map_lat} onChange={(e) => setCoordinate('map_lat', e.target.value)} placeholder="14.6406" className={adminFieldClass(!!errors.map_lat)} />
                                </FormField>
                                <FormField label="Longitude" error={errors.map_lng}>
                                    <input inputMode="decimal" value={data.map_lng} onChange={(e) => setCoordinate('map_lng', e.target.value)} placeholder="121.0660" className={adminFieldClass(!!errors.map_lng)} />
                                </FormField>
                            </div>
                            <FormField
                                label="Address"
                                error={errors.address}
                                hint={
                                    pin ? (
                                        <button type="button" onClick={() => void fillAddressFromPin()} disabled={filling} className="font-medium text-primary hover:underline">
                                            {filling ? 'Looking up…' : 'Fill address from the pin'}
                                        </button>
                                    ) : (
                                        'Shown on the website under “Find us”.'
                                    )
                                }
                            >
                                <textarea rows={2} value={data.address} onChange={(e) => setData('address', e.target.value)} placeholder="88 Maginhawa St., Teachers Village, Quezon City" className={adminFieldClass(!!errors.address) + ' resize-y'} />
                            </FormField>
                            <FormField label="Google Maps link (optional)" error={errors.map_url} hint="Your café's Google Maps page, for reviews and photos. Used by “Open in Maps”.">
                                <input type="url" value={data.map_url} onChange={(e) => setData('map_url', e.target.value)} placeholder="https://maps.app.goo.gl/…" className={adminFieldClass(!!errors.map_url)} />
                            </FormField>
                            {pin && (
                                <button type="button" onClick={() => setData((prev) => ({ ...prev, map_lat: '', map_lng: '' }))} className="text-xs font-medium text-error hover:underline">
                                    Remove pin (use the address only)
                                </button>
                            )}
                        </div>

                        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
                            <p className="text-sm font-medium text-foreground">What customers see</p>
                            {googlePreview ? (
                                <iframe title="Website map preview" src={googlePreview} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-56 w-full rounded-xl border border-border" />
                            ) : (
                                <p className="rounded-xl bg-muted/40 px-4 py-10 text-center text-xs text-muted-foreground">Drop a pin or add an address to preview.</p>
                            )}
                            <p className="text-xs text-muted-foreground">The website shows this Google map with “Get directions”.</p>
                        </div>
                    </div>

                    <div className="sticky bottom-0 z-[1000] border-t border-border bg-background/90 py-3 backdrop-blur">
                        <Button type="submit" disabled={processing} size="lg">
                            {processing ? 'Saving...' : 'Save Location'}
                        </Button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
