import { Head, router, useForm, usePage } from '@inertiajs/react';
import { CalendarClock, Edit2, Megaphone, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { CrudModal } from '@/components/admin/crud-modal';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminCmsBannersDestroy, adminCmsBannersStore, adminCmsBannersUpdate } from '@/lib/routes';

interface Banner {
    id: number;
    title: string;
    subtitle: string | null;
    body: string | null;
    badge: string | null;
    theme: string;
    cta_label: string | null;
    cta_url: string | null;
    starts_at: string | null;
    ends_at: string | null;
    is_active: boolean;
    is_live: boolean;
    sort_order: number;
    image_url: string | null;
}

interface Props {
    banners: Banner[];
    themes: string[];
}

/** Mirrors the storefront banner themes so admins see roughly what customers will see. */
const THEME_STYLES: Record<string, { label: string; className: string; emoji: string }> = {
    honey: { label: 'Honey', className: 'bg-gradient-to-br from-amber-300 to-amber-500 text-stone-900', emoji: '🍯' },
    espresso: { label: 'Espresso', className: 'bg-gradient-to-br from-stone-800 to-stone-950 text-amber-50', emoji: '☕' },
    love: { label: 'Love Month', className: 'bg-gradient-to-br from-rose-400 to-pink-600 text-white', emoji: '💘' },
    christmas: { label: 'Christmas', className: 'bg-gradient-to-br from-emerald-700 to-red-700 text-white', emoji: '🎄' },
    matcha: { label: 'Matcha', className: 'bg-gradient-to-br from-lime-600 to-emerald-800 text-white', emoji: '🍵' },
    summer: { label: 'Summer', className: 'bg-gradient-to-br from-sky-400 to-orange-400 text-white', emoji: '🌞' },
};

type BannerForm = {
    title: string;
    subtitle: string;
    body: string;
    badge: string;
    theme: string;
    cta_label: string;
    cta_url: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
    sort_order: string;
    image: File | null;
    remove_image: boolean;
    _method?: string;
};

const EMPTY_FORM: BannerForm = {
    title: '', subtitle: '', body: '', badge: '', theme: 'honey', cta_label: '', cta_url: '',
    starts_at: '', ends_at: '', is_active: true, sort_order: '0', image: null, remove_image: false,
};

function schedule(banner: Banner) {
    const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    if (!banner.starts_at && !banner.ends_at) {
        return 'Always';
    }

    return `${banner.starts_at ? fmt(banner.starts_at) : 'Now'} → ${banner.ends_at ? fmt(banner.ends_at) : 'No end'}`;
}

export default function BannersIndex({ banners, themes }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Banner | null>(null);
    const [deleting, setDeleting] = useState<Banner | null>(null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<BannerForm>(EMPTY_FORM);

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    function openCreate() {
        reset();
        clearErrors();
        setEditing(null);
        setModalOpen(true);
    }

    function openEdit(banner: Banner) {
        clearErrors();
        setEditing(banner);
        setData({
            title: banner.title,
            subtitle: banner.subtitle ?? '',
            body: banner.body ?? '',
            badge: banner.badge ?? '',
            theme: banner.theme,
            cta_label: banner.cta_label ?? '',
            cta_url: banner.cta_url ?? '',
            starts_at: banner.starts_at ?? '',
            ends_at: banner.ends_at ?? '',
            is_active: banner.is_active,
            sort_order: String(banner.sort_order),
            image: null,
            remove_image: false,
            _method: 'PUT',
        });
        setModalOpen(true);
    }

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(editing ? adminCmsBannersUpdate(editing.id) : adminCmsBannersStore(), {
            forceFormData: true,
            onSuccess: () => setModalOpen(false),
        });
    }

    function confirmDelete() {
        if (!deleting) {
            return;
        }

        router.delete(adminCmsBannersDestroy(deleting.id), { onFinish: () => setDeleting(null) });
    }

    const theme = THEME_STYLES[data.theme] ?? THEME_STYLES.honey;

    return (
        <AdminLayout>
            <Head title="Banners" />
            <Toaster position="top-right" />

            <PageHeader
                title="Promo & Event Banners"
                breadcrumbs={[{ label: 'CMS' }, { label: 'Banners' }]}
                actions={
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> New Banner
                    </Button>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                Announce promos and events (Love Month, Christmas, new drinks…) on the website. Banners show automatically between their start and end dates.
            </p>

            {banners.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                    <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 font-semibold text-foreground">No banners yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create your first promo or event banner for the website.</p>
                    <Button className="mt-5" onClick={openCreate}>
                        <Plus className="h-4 w-4" /> New Banner
                    </Button>
                </div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {banners.map((banner) => {
                        const style = THEME_STYLES[banner.theme] ?? THEME_STYLES.honey;

                        return (
                            <div key={banner.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                                <div className={`relative flex aspect-[16/9] flex-col justify-end p-5 ${style.className}`}>
                                    {banner.image_url && <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
                                    <span className="absolute top-4 right-4 text-3xl">{style.emoji}</span>
                                    <div className="relative">
                                        {banner.badge && <span className="mb-2 inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur">{banner.badge}</span>}
                                        <p className="text-lg leading-tight font-bold">{banner.title}</p>
                                        {banner.subtitle && <p className="mt-1 line-clamp-2 text-sm opacity-90">{banner.subtitle}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between gap-3 p-4">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {banner.is_live ? <Badge variant="success">Live</Badge> : banner.is_active ? <Badge variant="warning">Scheduled / ended</Badge> : <Badge variant="neutral">Hidden</Badge>}
                                            <span className="text-xs text-muted-foreground">{style.label}</span>
                                        </div>
                                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <CalendarClock className="h-3.5 w-3.5" /> {schedule(banner)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                        <button onClick={() => openEdit(banner)} aria-label="Edit banner" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setDeleting(banner)} aria-label="Delete banner" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CrudModal
                open={modalOpen}
                onOpenChange={setModalOpen}
                title={editing ? 'Edit Banner' : 'New Banner'}
                className="max-w-2xl"
                footer={
                    <Button type="submit" form="banner-form" disabled={processing} className="w-full sm:w-auto">
                        {processing ? 'Saving...' : editing ? 'Save Changes' : 'Create Banner'}
                    </Button>
                }
            >
                <form id="banner-form" onSubmit={submit} className="space-y-4">
                    <FormField label="Theme" required error={errors.theme}>
                        <div className="grid grid-cols-3 gap-2">
                            {themes.map((key) => {
                                const option = THEME_STYLES[key] ?? THEME_STYLES.honey;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setData('theme', key)}
                                        className={`rounded-xl px-3 py-2.5 text-left text-xs font-semibold ring-offset-2 transition ${option.className} ${data.theme === key ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100'}`}
                                    >
                                        <span className="mr-1">{option.emoji}</span>
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Title" required error={errors.title} className="col-span-2">
                            <input value={data.title} onChange={(e) => setData('title', e.target.value)} placeholder="Love Month: 2 lattes for ₱250" className={adminFieldClass(!!errors.title)} />
                        </FormField>
                        <FormField label="Badge" error={errors.badge} hint="Short tag, e.g. PROMO, EVENT, NEW">
                            <input value={data.badge} onChange={(e) => setData('badge', e.target.value)} placeholder="Love Month" className={adminFieldClass(!!errors.badge)} />
                        </FormField>
                        <FormField label="Sort order" error={errors.sort_order} hint="Lower shows first">
                            <input type="number" min="0" value={data.sort_order} onChange={(e) => setData('sort_order', e.target.value)} className={adminFieldClass(!!errors.sort_order)} />
                        </FormField>
                        <FormField label="Subtitle" error={errors.subtitle} className="col-span-2">
                            <input value={data.subtitle} onChange={(e) => setData('subtitle', e.target.value)} placeholder="Feb 1–14 · Bring your someone special" className={adminFieldClass(!!errors.subtitle)} />
                        </FormField>
                        <FormField label="Details" error={errors.body} className="col-span-2">
                            <textarea rows={3} value={data.body} onChange={(e) => setData('body', e.target.value)} placeholder="Mechanics, schedule, what's included…" className={adminFieldClass(!!errors.body) + ' resize-y'} />
                        </FormField>
                        <FormField label="Button label" error={errors.cta_label}>
                            <input value={data.cta_label} onChange={(e) => setData('cta_label', e.target.value)} placeholder="Order now" className={adminFieldClass(!!errors.cta_label)} />
                        </FormField>
                        <FormField label="Button link" error={errors.cta_url} hint="e.g. /menu or a Facebook event link">
                            <input value={data.cta_url} onChange={(e) => setData('cta_url', e.target.value)} placeholder="/menu" className={adminFieldClass(!!errors.cta_url)} />
                        </FormField>
                        <FormField label="Show from" error={errors.starts_at} hint="Empty = right away">
                            <input type="datetime-local" value={data.starts_at} onChange={(e) => setData('starts_at', e.target.value)} className={adminFieldClass(!!errors.starts_at)} />
                        </FormField>
                        <FormField label="Show until" error={errors.ends_at} hint="Empty = no end date">
                            <input type="datetime-local" value={data.ends_at} onChange={(e) => setData('ends_at', e.target.value)} className={adminFieldClass(!!errors.ends_at)} />
                        </FormField>
                    </div>

                    <FormField label="Image" error={errors.image} hint="Optional — shown behind the banner text. Wide images work best.">
                        <ImageUploadField
                            file={data.image}
                            currentUrl={editing?.image_url ?? null}
                            removed={data.remove_image}
                            onFileChange={(file) => setData((prev) => ({ ...prev, image: file, remove_image: false }))}
                            onRemove={() => setData('remove_image', true)}
                        />
                    </FormField>

                    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold ${theme.className}`}>
                        <span className="text-xl">{theme.emoji}</span>
                        <span>Preview colours: {data.title || 'Your banner title'}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                        <div>
                            <span className="text-sm font-medium text-foreground">Visible on website</span>
                            <p className="text-xs text-muted-foreground">Turn off to hide without deleting.</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={data.is_active}
                            onClick={() => setData('is_active', !data.is_active)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${data.is_active ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200" style={{ transform: data.is_active ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </form>
            </CrudModal>

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={confirmDelete}
                title={deleting ? `Delete "${deleting.title}"?` : 'Delete banner?'}
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
