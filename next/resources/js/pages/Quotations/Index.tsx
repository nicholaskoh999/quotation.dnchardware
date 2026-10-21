import { Link } from '@inertiajs/react';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route quotations.index). Session D's read layer replaces the
   notice with the real list at W1 integration. */
export default function QuotationsIndex() {
    return (
        <AppLayout title="Quotations">
            <PageHeader
                title="Quotations"
                description="Saved quotations, newest first."
                actions={
                    <Button asChild variant="primary">
                        <Link href="/quotations/new">
                            <FilePlus2 aria-hidden="true" />
                            New Quotation
                        </Link>
                    </Button>
                }
            />
            <PreviewNotice feature="Quotation list" arrives="Wave 1 integration (read-only, from the existing quotation records)">
                Opening, editing and saving quotations arrive with the Quotation Builder and Write Path in Wave 2. Nothing is shown
                here until real records are connected.
            </PreviewNotice>
        </AppLayout>
    );
}
