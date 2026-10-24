import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { ExternalLink, Info, MapPin, Share2, Sparkles, Star } from 'lucide-react';
import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { FormField, adminFieldClass } from '@/components/admin/form-field';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/layouts/admin-layout';
import { adminCmsContentUpdate, adminCmsLocation } from '@/lib/routes';

type Content = Record<string, string | null>;

interface Props {
    content: Content;
    defaults: Record<string, string>;
    frontend_url: string;
}

function Section({ icon: Icon, title, description, children }: { icon: typeof Info; title: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                </span>
                <div>
                    <h2 className="font-semibold text-foreground">{title}</h2>
                    {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

const TEXT_FIELDS = [
    'hero_eyebrow', 'hero_title', 'hero_subtitle', 'hero_cta_label',
    'about_title', 'about_body',
    'highlight_1_icon', 'highlight_1_title', 'highlight_1_text',
    'highlight_2_icon', 'highlight_2_title', 'highlight_2_text',
    'highlight_3_icon', 'highlight_3_title', 'highlight_3_text',
    'phone', 'email', 'hours',
    'facebook_url', 'instagram_url', 'tiktok_url',
] as const;

type TextField = (typeof TEXT_FIELDS)[number];

type FormData = Record<TextField, string> & {
    _method: 'PUT';
    hero_image: File | null;
    about_image: File | null;
    remove_hero_image: boolean;
    remove_about_image: boolean;
};

export default function SiteContentPage({ content, defaults, frontend_url }: Props) {
    const { flash } = usePage().props as { flash?: { success?: string } };

    const initial = Object.fromEntries(TEXT_FIELDS.map((field) => [field, content[field] ?? ''])) as Record<TextField, string>;

    const { data, setData, post, processing, errors } = useForm<FormData>({
        ...initial,
        _method: 'PUT',
        hero_image: null,
        about_image: null,
        remove_hero_image: false,
        remove_about_image: false,
    });

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(adminCmsContentUpdate(), { forceFormData: true, preserveScroll: true });
    }

    const text = (field: TextField, props: { placeholder?: string; type?: string } = {}) => (
        <input
            type={props.type ?? 'text'}
            value={data[field]}
            onChange={(e) => setData(field, e.target.value)}
            placeholder={props.placeholder ?? defaults[field]}
            className={adminFieldClass(!!errors[field])}
        />
    );

    const area = (field: TextField, rows = 4, placeholder?: string) => (
        <textarea
            rows={rows}
            value={data[field]}
            onChange={(e) => setData(field, e.target.value)}
            placeholder={placeholder ?? defaults[field]}
            className={adminFieldClass(!!errors[field]) + ' resize-y'}
        />
    );

    return (
        <AdminLayout>
            <Head title="Site Content" />
            <Toaster position="top-right" />
            <div className="max-w-4xl">
                <PageHeader
                    title="Site Content"
                    breadcrumbs={[{ label: 'CMS' }, { label: 'Site Content' }]}
                    actions={
                        <a href={frontend_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                            View website <ExternalLink className="h-4 w-4" />
                        </a>
                    }
                />
                <p className="-mt-3 mb-6 text-sm text-muted-foreground">
                    The words and photos on your online storefront&apos;s home page. Leave a text field empty to use the default shown in grey.
                </p>

                <form onSubmit={submit} className="space-y-6">
                    <Section icon={Sparkles} title="Hero" description="The big welcome section at the top of the website.">
                        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                            <div className="space-y-4">
                                <FormField label="Small heading" error={errors.hero_eyebrow}>{text('hero_eyebrow')}</FormField>
                                <FormField label="Headline" error={errors.hero_title}>{text('hero_title')}</FormField>
                                <FormField label="Intro text" error={errors.hero_subtitle}>{area('hero_subtitle', 3)}</FormField>
                                <FormField label="Order button label" error={errors.hero_cta_label}>{text('hero_cta_label')}</FormField>
                            </div>
                            <FormField label="Hero photo" error={errors.hero_image} hint="Wide photo of your café or signature drink">
                                <ImageUploadField
                                    file={data.hero_image}
                                    currentUrl={content.hero_image_url}
                                    removed={data.remove_hero_image}
                                    onFileChange={(file) => {
                                        setData((prev) => ({ ...prev, hero_image: file, remove_hero_image: false }));
                                    }}
                                    onRemove={() => setData('remove_hero_image', true)}
                                    aspect="aspect-[4/5]"
                                />
                            </FormField>
                        </div>
                    </Section>

                    <Section icon={Star} title="Highlights" description="Three short reasons people love your café.">
                        <div className="grid gap-4 md:grid-cols-3">
                            {([1, 2, 3] as const).map((n) => (
                                <div key={n} className="space-y-3 rounded-xl border border-border p-4">
                                    <FormField label="Emoji" error={errors[`highlight_${n}_icon`]}>{text(`highlight_${n}_icon`)}</FormField>
                                    <FormField label="Title" error={errors[`highlight_${n}_title`]}>{text(`highlight_${n}_title`)}</FormField>
                                    <FormField label="Text" error={errors[`highlight_${n}_text`]}>{area(`highlight_${n}_text`, 3)}</FormField>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section icon={Info} title="About / Our story">
                        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                            <div className="space-y-4">
                                <FormField label="Title" error={errors.about_title}>{text('about_title')}</FormField>
                                <FormField label="Story" error={errors.about_body} hint="Separate paragraphs with an empty line.">
                                    {area('about_body', 8)}
                                </FormField>
                            </div>
                            <FormField label="Story photo" error={errors.about_image}>
                                <ImageUploadField
                                    file={data.about_image}
                                    currentUrl={content.about_image_url}
                                    removed={data.remove_about_image}
                                    onFileChange={(file) => {
                                        setData((prev) => ({ ...prev, about_image: file, remove_about_image: false }));
                                    }}
                                    onRemove={() => setData('remove_about_image', true)}
                                    aspect="aspect-square"
                                />
                            </FormField>
                        </div>
                    </Section>

                    <Section icon={MapPin} title="Visit us" description="Contact details shown near the bottom of the website.">
                        <p className="mb-4 rounded-xl bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
                            The address and map pin are managed on the{' '}
                            <Link href={adminCmsLocation()} className="font-medium text-primary hover:underline">
                                Location
                            </Link>{' '}
                            page.
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField label="Phone" error={errors.phone}>{text('phone', { placeholder: '0917 123 4567' })}</FormField>
                            <FormField label="Email" error={errors.email}>{text('email', { placeholder: 'hello@milkandhoney.cafe', type: 'email' })}</FormField>
                            <FormField
                                label="Opening hours"
                                className="md:col-span-2"
                                error={errors.hours}
                                hint="One line per day range. Leave empty to use the opening / closing time from Settings."
                            >
                                {area('hours', 3, 'Mon – Fri · 7:00 AM – 9:00 PM\nSat – Sun · 8:00 AM – 10:00 PM')}
                            </FormField>
                        </div>
                    </Section>

                    <Section icon={Share2} title="Social media">
                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField label="Facebook" error={errors.facebook_url}>{text('facebook_url', { placeholder: 'https://facebook.com/…', type: 'url' })}</FormField>
                            <FormField label="Instagram" error={errors.instagram_url}>{text('instagram_url', { placeholder: 'https://instagram.com/…', type: 'url' })}</FormField>
                            <FormField label="TikTok" error={errors.tiktok_url}>{text('tiktok_url', { placeholder: 'https://tiktok.com/@…', type: 'url' })}</FormField>
                        </div>
                    </Section>

                    <div className="sticky bottom-0 border-t border-border bg-background/90 py-3 backdrop-blur">
                        <Button type="submit" disabled={processing} size="lg">
                            {processing ? 'Saving...' : 'Save Content'}
                        </Button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
}
