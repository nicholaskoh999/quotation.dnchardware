import { Link } from '@inertiajs/react';
import { FilePlus2 } from 'lucide-react';
import { DraftCard } from '@/components/home/draft-card';
import { FrequentProducts } from '@/components/home/frequent-products';
import { QuickActions } from '@/components/home/quick-actions';
import { RecentQuotations } from '@/components/home/recent-quotations';
import { useShell } from '@/components/shell/use-shell';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import AppLayout from '@/layouts/app-layout';
import type { RecentQuotation } from '@/types';

/* Route `/` (handoff §8 Mobile Home v1 + desktop Overview). Phone (< 640)
   gets the native-app Home; tablet/desktop get the Overview layout. Both are
   built from the same section components; neither has KPIs, delete controls
   or retired settings. */
export default function Home({ recentQuotations }: { recentQuotations?: RecentQuotation[] }) {
    const { user, workspaceUrl } = useShell();
    const items = Array.isArray(recentQuotations) ? recentQuotations : undefined;
    return (
        <AppLayout title="Home">
            {/* phone Home */}
            <div className="flex flex-col gap-4 sm:hidden" data-testid="phone-home">
                <p className="text-sm text-muted-foreground">{user ? `Hello, ${user.displayName}` : 'Welcome to DNC Quotation'}</p>
                <DraftCard />
                <QuickActions workspaceUrl={workspaceUrl} />
                <RecentQuotations items={items} />
                <FrequentProducts />
            </div>

            {/* tablet + desktop Overview */}
            <div className="hidden sm:block" data-testid="desktop-overview">
                <PageHeader
                    title="Overview"
                    description={user ? `Welcome back, ${user.displayName}.` : 'Start or continue a quotation.'}
                    actions={
                        <Button asChild variant="primary">
                            <Link href="/quotations/new">
                                <FilePlus2 aria-hidden="true" />
                                New Quotation
                            </Link>
                        </Button>
                    }
                />
                {/* Main column takes the width; the side column keeps a fixed,
                    uncompressed width for Draft + Quick Actions. One primary CTA
                    (the header button); the others are secondary entry points. */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
                    <div className="flex min-w-0 flex-col gap-5">
                        <RecentQuotations items={items} />
                        <FrequentProducts />
                    </div>
                    <div className="flex flex-col gap-5">
                        <DraftCard ctaVariant="secondary" />
                        <QuickActions workspaceUrl={workspaceUrl} layout="list" />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
