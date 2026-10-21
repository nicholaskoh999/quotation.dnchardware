import { DatabaseZap, PlugZap } from 'lucide-react';
import type { DataSourceState } from '@/types/legacy';

/* The honest page state when there is no legacy data to show. Not an error
   page: the application works, the data source is simply not connected (or
   could not be read) on this host. */
export function DataSourceNotice({ source }: { source: DataSourceState }) {
    if (source === 'connected') return null;
    const notConfigured = source === 'not_configured';
    const Icon = notConfigured ? PlugZap : DatabaseZap;
    return (
        <div
            role="status"
            data-testid="data-source-notice"
            data-source={source}
            className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-xs"
        >
            <Icon className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div>
                <h2 className="font-semibold">{notConfigured ? 'Data source not connected' : 'Data source not reachable'}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {notConfigured
                        ? 'No legacy quotation database is configured on this host, so there is nothing to show yet.'
                        : 'The legacy quotation database could not be read just now. Please try again later.'}
                </p>
            </div>
        </div>
    );
}

export function ReadOnlyNote() {
    return <p className="text-xs text-subtle-foreground">Read-only preview of saved legacy data.</p>;
}
