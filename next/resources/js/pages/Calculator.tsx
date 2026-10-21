import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route calculator). Calculations belong to the domain engine
   (resources/js/domain), never to this page. */
export default function Calculator() {
    return (
        <AppLayout title="Calculator">
            <PageHeader title="Calculator" description="Weight and price calculation for a single item." />
            <PreviewNotice feature="Calculator" arrives="a later wave, on top of the shared calculation engine" />
        </AppLayout>
    );
}
