import { Head, Link } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FoundationLayout from '@/layouts/foundation-layout';

const MESSAGES: Record<number, { title: string; body: string }> = {
    403: { title: 'Not allowed', body: 'You do not have access to this page.' },
    404: { title: 'Page not found', body: 'The page you asked for does not exist.' },
    419: { title: 'Session expired', body: 'Please refresh the page and try again.' },
    429: { title: 'Too many requests', body: 'Please wait a moment and try again.' },
    500: { title: 'Something went wrong', body: 'The error has been logged. Please try again.' },
    503: { title: 'Temporarily unavailable', body: 'The application is being updated. Please try again shortly.' },
};

/* Rendered for HTTP errors outside local debug. Shows a short, translated-ready
   message and a reference only — never an exception message, path or SQL. */
export default function ErrorPage({ status, reference }: { status: number; reference?: string | null }) {
    const m = MESSAGES[status] ?? MESSAGES[500]!;
    return (
        <FoundationLayout>
            <Head title={m.title} />
            <div role="alert" className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-6 text-center shadow-xs">
                <AlertTriangle className="mx-auto mb-3 size-8 text-danger" aria-hidden="true" />
                <h1 className="text-lg font-semibold">
                    {m.title} <span className="text-subtle-foreground">({status})</span>
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
                {reference ? <p className="mt-2 text-xs text-subtle-foreground">Reference: {reference}</p> : null}
                <Button asChild variant="primary" className="mt-4">
                    <Link href="/">Back to Home</Link>
                </Button>
            </div>
        </FoundationLayout>
    );
}
