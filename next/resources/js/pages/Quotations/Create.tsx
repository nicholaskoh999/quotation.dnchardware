import { useShell } from '@/components/shell/use-shell';
import { FREQUENT_PRODUCTS } from '@/components/shell/nav-config';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route quotations.create). `?mode=quick|manual` and
   `?product=<key>` are accepted so the shell's entry points already land
   here; the builder (Wave 2) and Quick Add (Wave 3) replace this page. */
export default function QuotationsCreate() {
    const { url } = useShell();
    const query = new URLSearchParams(url.split('?')[1] ?? '');
    const mode = query.get('mode');
    const product = FREQUENT_PRODUCTS.find((p) => p.key === query.get('product'));
    return (
        <AppLayout title="New Quotation">
            <PageHeader title="New Quotation" description="Draft / Not saved — a quotation number is only given after a real Save." />
            <div className="flex flex-col gap-4">
                {mode === 'quick' ? (
                    <PreviewNotice feature="Quick Add" arrives="Wave 3">
                        Paste or describe items and review them before they are added.
                    </PreviewNotice>
                ) : null}
                <PreviewNotice feature={mode === 'manual' ? 'Manual Add' : 'Quotation Builder'} arrives="Wave 2">
                    {product ? (
                        <p>
                            Selected product: <span className="font-medium text-foreground">{product.label}</span>. It will be pre-chosen when
                            the builder is available.
                        </p>
                    ) : (
                        <p>Customer, items and pricing are entered here once the builder is available.</p>
                    )}
                </PreviewNotice>
            </div>
        </AppLayout>
    );
}
