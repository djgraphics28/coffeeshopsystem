import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Eye, EyeOff, ImagePlus, Images, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { adminFieldClass } from '@/components/admin/form-field';
import { PageHeader } from '@/components/admin/page-header';
import AdminLayout from '@/layouts/admin-layout';
import { adminCmsGalleryDestroy, adminCmsGalleryStore, adminCmsGalleryUpdate } from '@/lib/routes';

interface GalleryImage {
    id: number;
    caption: string | null;
    is_active: boolean;
    sort_order: number;
    image_url: string | null;
}

interface Props {
    images: GalleryImage[];
}

export default function GalleryIndex({ images }: Props) {
    const { flash, errors } = usePage().props as { flash?: { success?: string }; errors: Record<string, string> };
    const [deleting, setDeleting] = useState<GalleryImage | null>(null);
    const upload = useForm<{ images: File[] }>({ images: [] });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    function uploadFiles(files: FileList | null) {
        if (!files?.length) {
            return;
        }

        upload.transform(() => ({ images: Array.from(files) }));
        upload.post(adminCmsGalleryStore(), { forceFormData: true, preserveScroll: true });
    }

    function save(image: GalleryImage, changes: Partial<Pick<GalleryImage, 'caption' | 'is_active' | 'sort_order'>>) {
        router.put(
            adminCmsGalleryUpdate(image.id),
            { caption: image.caption, is_active: image.is_active, sort_order: image.sort_order, ...changes },
            { preserveScroll: true },
        );
    }

    const uploadError = Object.entries(errors ?? {}).find(([key]) => key.startsWith('images'))?.[1];

    return (
        <AdminLayout>
            <Head title="Gallery" />
            <Toaster position="top-right" />

            <PageHeader
                title="Photo Gallery"
                breadcrumbs={[{ label: 'CMS' }, { label: 'Gallery' }]}
                actions={
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90">
                        <ImagePlus className="h-4 w-4" />
                        {upload.processing ? 'Uploading…' : 'Upload photos'}
                        <input type="file" accept="image/*" multiple className="hidden" disabled={upload.processing} onChange={(e) => uploadFiles(e.target.files)} />
                    </label>
                }
            />
            <p className="-mt-4 mb-6 text-sm text-muted-foreground">
                Photos of your café, drinks and events for the website gallery. Upload several at once (up to 4MB each).
            </p>
            {uploadError && <p className="mb-4 rounded-lg bg-error/10 px-4 py-2 text-sm text-error">{uploadError}</p>}

            {images.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                    <Images className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="mt-3 font-semibold text-foreground">No photos yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Upload photos to show a gallery on your website.</p>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {images.map((image) => (
                        <div key={image.id} className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${image.is_active ? '' : 'opacity-60'}`}>
                            <div className="relative aspect-square bg-muted">
                                {image.image_url && <img src={image.image_url} alt={image.caption ?? ''} className="h-full w-full object-cover" />}
                                {!image.is_active && <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[11px] font-semibold text-white">Hidden</span>}
                            </div>
                            <div className="space-y-2 p-3">
                                <input
                                    defaultValue={image.caption ?? ''}
                                    placeholder="Add a caption"
                                    onBlur={(e) => e.target.value !== (image.caption ?? '') && save(image, { caption: e.target.value })}
                                    className={adminFieldClass()}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        Order
                                        <input
                                            type="number"
                                            min="0"
                                            defaultValue={image.sort_order}
                                            onBlur={(e) => Number(e.target.value) !== image.sort_order && save(image, { sort_order: Number(e.target.value) })}
                                            className={adminFieldClass() + ' w-16 px-2 py-1'}
                                        />
                                    </label>
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => save(image, { is_active: !image.is_active })}
                                            aria-label={image.is_active ? 'Hide photo' : 'Show photo'}
                                            title={image.is_active ? 'Hide from website' : 'Show on website'}
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                                        >
                                            {image.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleting(image)}
                                            aria-label="Delete photo"
                                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={!!deleting}
                onOpenChange={(open) => !open && setDeleting(null)}
                onConfirm={() => deleting && router.delete(adminCmsGalleryDestroy(deleting.id), { preserveScroll: true, onFinish: () => setDeleting(null) })}
                title="Delete this photo?"
                confirmLabel="Delete"
            />
        </AdminLayout>
    );
}
