import { Info } from 'lucide-react';
import { useShell } from '@/components/shell/use-shell';
import { InlineAlert } from '@/components/ui/inline-alert';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewNotice } from '@/components/ui/preview-notice';
import AppLayout from '@/layouts/app-layout';

/* Placeholder (route system-health). Shows only the release identity the
   server already shares (handoff §28 "release version" is employee-safe). */
export default function SystemHealth() {
    const { release } = useShell();
    return (
        <AppLayout title="System Health">
            <PageHeader title="System Health" description="Is the application working, and which release is running." />
            <div className="flex flex-col gap-4">
                {release ? (
                    <InlineAlert tone="info" title="Release">
                        <span className="inline-flex items-center gap-1.5" data-testid="system-health-release">
                            <Info className="size-3.5" aria-hidden="true" />
                            Version {release.version}
                            {release.shortSha ? ` · ${release.shortSha}` : ''}
                        </span>
                    </InlineAlert>
                ) : null}
                <PreviewNotice feature="System Health checks" arrives="Wave 3" />
            </div>
        </AppLayout>
    );
}
