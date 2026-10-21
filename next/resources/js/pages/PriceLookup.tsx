import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route price-lookup). */
export default function PriceLookup() {
    return (
        <AppLayout title="Price Lookup">
            <PageHeader title="Price Lookup" description="Search previous prices by customer, product, size and material." />
            <PreviewNotice feature="Smart Search / Price Lookup" arrives="Wave 2" />
        </AppLayout>
    );
}
