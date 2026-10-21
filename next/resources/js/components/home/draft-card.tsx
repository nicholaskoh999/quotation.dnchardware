import { Link } from '@inertiajs/react';
import { FilePlus2, FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* Current / Recovered Draft card SHELL (handoff §7 / §8). Local draft
   autosave arrives with the Quotation Builder (Wave 2); until then this card
   honestly says there is no draft — it never shows an invented one. */
export function DraftCard({ className }: { className?: string }) {
    return (
        <section
            aria-labelledby="draft-card-title"
            data-testid="draft-card"
            className={cn('rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs', className)}
        >
            <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                    <FileClock className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id="draft-card-title" className="text-sm font-semibold text-foreground">
                        No draft
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        An unsaved quotation you are working on will appear here so you can continue it.
                    </p>
                </div>
            </div>
            <Button asChild variant="primary" className="mt-3 w-full sm:w-auto">
                <Link href="/quotations/new">
                    <FilePlus2 aria-hidden="true" />
                    New Quotation
                </Link>
            </Button>
        </section>
    );
}
