import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route settings). Retired legacy settings (Default Prices,
   Diameter Settings, Pricing Guide, Version Updates) do not return here. */
export default function Settings() {
    return (
        <AppLayout title="Settings">
            <PageHeader title="Settings" description="Your preferences and quotation defaults." />
            <PreviewNotice feature="Settings" arrives="a later wave" />
        </AppLayout>
    );
}
