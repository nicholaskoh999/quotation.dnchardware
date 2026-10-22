import { Link } from '@inertiajs/react';
import { FilePlus2, FileClock } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* Current / Recovered Draft card SHELL (handoff §7 / §8). Local draft
   autosave arrives with the Quotation Builder (Wave 2); until then this card
   honestly says there is no draft — it never shows an invented one.
   `ctaVariant`: the desktop Overview already has the page's primary New
   Quotation button, so there the card's button steps down to secondary. */
export function DraftCard({ className, ctaVariant = 'primary' }: { className?: string; ctaVariant?: ButtonProps['variant'] }) {
    return (
        <section
            aria-labelledby="draft-card-title"
            data-testid="draft-card"
            className={cn('rounded-[var(--radius-lg)] border border-border bg-surface p-3.5 shadow-xs sm:p-4', className)}
        >
            <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                    <FileClock className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id="draft-card-title" className="text-sm font-semibold text-foreground">
                        No draft
                    </h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">An unsaved quotation will appear here to continue.</p>
                </div>
            </div>
            <Button asChild variant={ctaVariant} className="mt-3 w-full sm:w-auto">
                <Link href="/quotations/new">
                    <FilePlus2 aria-hidden="true" />
                    New Quotation
                </Link>
            </Button>
        </section>
    );
}
