import { ImagePlus, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

type ImageUploadFieldProps = {
    /** Newly picked file (not yet saved). */
    file: File | null;
    /** URL of the image already saved on the server. */
    currentUrl: string | null;
    /** True when the admin asked to remove the saved image. */
    removed?: boolean;
    onFileChange: (file: File | null) => void;
    onRemove?: () => void;
    aspect?: string;
    hint?: string;
};

/** Image picker with a live preview, used by the CMS forms. */
export function ImageUploadField({ file, currentUrl, removed = false, onFileChange, onRemove, aspect = 'aspect-[16/9]', hint }: ImageUploadFieldProps) {
    const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const shownUrl = previewUrl ?? (removed ? null : currentUrl);

    return (
        <div className="space-y-2">
            <label
                className={cn(
                    'group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[var(--ap-input-border)] bg-muted/30 transition-colors hover:border-primary',
                    aspect,
                )}
            >
                {shownUrl ? (
                    <>
                        <img src={shownUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1.5 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Click to replace
                        </span>
                    </>
                ) : (
                    <span className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                        <ImagePlus className="h-6 w-6" />
                        Upload image
                    </span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{file ? `✓ ${file.name}` : (hint ?? 'JPG or PNG, up to 4MB')}</span>
                {shownUrl && (
                    <button
                        type="button"
                        onClick={() => {
                            onFileChange(null);
                            onRemove?.();
                        }}
                        className="inline-flex items-center gap-1 font-medium text-error hover:underline"
                    >
                        <X className="h-3 w-3" /> Remove
                    </button>
                )}
            </div>
        </div>
    );
}
