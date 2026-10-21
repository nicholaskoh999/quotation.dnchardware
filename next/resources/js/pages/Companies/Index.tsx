import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route companies.index). */
export default function CompaniesIndex() {
    return (
        <AppLayout title="Companies">
            <PageHeader title="Companies" description="Customer companies and their contact details." />
            <PreviewNotice feature="Companies" arrives="Wave 2 (read-only data may be connected at Wave 1 integration)" />
        </AppLayout>
    );
}
