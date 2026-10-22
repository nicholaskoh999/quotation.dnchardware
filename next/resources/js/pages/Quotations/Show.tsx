import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Clock, FileWarning, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { formatDate, formatDimensions, formatPrice, formatStoredMoney, itemTitle, orDash, showsMaterialChips } from '@/components/legacy/format';
import { PageHeader } from '@/components/legacy/read-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { QuotationDetail, QuotationItem, QuotationShowProps, ReadableItem, RevisionHistory } from '@/types/legacy';

/* A saved legacy quotation, read only: header, the items in their saved order
   (insertion order is the item number), the customer unit price per item and
   the total AS SAVED. No Edit / Delete / Save, and no Cost Rate / Additional
   Cost / Markup — the page payload does not even carry them. */
export default function QuotationShow({ source, quotation, revisions }: QuotationShowProps) {
    return (
        <AppLayout>
            <Head title={quotation?.refNo ?? 'Quotation'} />
            <Button asChild variant="ghost" size="sm" className="mb-3">
                <Link href="/quotations">
                    <ArrowLeft aria-hidden="true" /> Quotations
                </Link>
            </Button>
            {source !== 'connected' || !quotation ? (
                <DataSourceNotice source={source === 'connected' ? 'unavailable' : source} />
            ) : (
                <>
                    <PageHeader title={quotation.refNo || `Quotation #${quotation.id}`} subtitle={<ReadOnlyNote />} />
                    <HeaderCard q={quotation} />
                    <ItemsSection q={quotation} />
                    <Card className="mt-3">
                        <CardContent className="flex items-baseline justify-between p-4 sm:px-5">
                            <span className="text-sm font-medium text-muted-foreground">Quotation Total</span>
                            <span className="text-lg font-semibold tabular-nums" data-testid="quotation-total">
                                {formatStoredMoney(quotation.totalAmount)}
                            </span>
                        </CardContent>
                    </Card>
                    <RevisionsSection history={revisions} />
                </>
            )}
        </AppLayout>
    );
}

function HeaderCard({ q }: { q: QuotationDetail }) {
    return (
        <Card>
            <CardContent className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                <Fact label="Customer">
                    {q.customerDisplay ?? '—'}
                    {q.companyId !== null && q.companyName ? (
                        <div>
                            <Link href={`/companies/${q.companyId}`} className="text-xs text-accent hover:underline">
                                Open company
                            </Link>
                        </div>
                    ) : null}
                </Fact>
                <Fact label="Contact / phone">{orDash(q.customerPhone)}</Fact>
                <Fact label="Date">{formatDate(q.quoteDate ?? q.createdAt)}</Fact>
                <Fact label="Valid until">{formatDate(q.validUntil)}</Fact>
                {/* Legacy rows may have no Prepared By: shown as not recorded, never inferred. */}
                <Fact label="Prepared by">
                    {q.preparedBy ? q.preparedBy : <span className="text-muted-foreground" data-testid="prepared-by-missing">Not recorded</span>}
                </Fact>
                <Fact label="Issued by">
                    <NotRecorded hint={q.issuerNote} testId="issued-by" />
                </Fact>
                {q.previousRefNo ? <Fact label="Formerly">{q.previousRefNo}</Fact> : null}
                {q.remarks ? (
                    <div className="sm:col-span-2 lg:col-span-4">
                        <Fact label="Remarks">{q.remarks}</Fact>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function ItemsSection({ q }: { q: QuotationDetail }) {
    return (
        <section aria-labelledby="items-heading" className="mt-5">
            <h2 id="items-heading" className="mb-2 text-base font-semibold">
                Items <span className="font-normal text-muted-foreground">({q.itemCount})</span>
            </h2>
            {q.itemsState === 'unreadable' ? (
                <Notice icon={<FileWarning className="size-5 text-danger" aria-hidden="true" />} testId="items-unreadable">
                    The items saved with this quotation could not be read. The saved total below is still the quotation’s total.
                </Notice>
            ) : null}
            {q.itemsState === 'empty' || q.itemsState === 'missing' ? (
                <Notice icon={<Info className="size-5 text-subtle-foreground" aria-hidden="true" />}>No items were saved with this quotation.</Notice>
            ) : null}
            <ol className="flex flex-col gap-2" data-testid="quotation-items">
                {q.items.map((item) => (
                    <li key={item.position}>
                        <ItemCard item={item} />
                    </li>
                ))}
            </ol>
        </section>
    );
}

function ItemCard({ item }: { item: QuotationItem }) {
    if (item.state === 'unreadable') {
        return (
            <Notice icon={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />} testId="item-unreadable">
                <span className="font-medium">Item {item.position}</span> — {item.reason}
            </Notice>
        );
    }
    return <ReadableItemCard item={item} />;
}

function ReadableItemCard({ item }: { item: ReadableItem }) {
    const m = item.material;
    const p = item.pricing;
    const chips = m && showsMaterialChips(m);
    const size = formatDimensions(item.sizeLabel);
    return (
        <Card data-testid="item-card" className="grid gap-3 p-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-6">
            <div className="min-w-0">
                {/* Product / size type is the identity; material and finish are supporting chips. */}
                <h3 className="flex items-baseline gap-2 text-base leading-snug font-semibold">
                    <span className="text-muted-foreground tabular-nums">{item.position}.</span>
                    <span data-testid="item-title">{itemTitle(item)}</span>
                </h3>
                {chips || item.finishLabel ? (
                    <div className="mt-1.5 flex flex-wrap gap-1" data-testid="item-chips">
                        {chips && m ? <Badge tone="accent">{m.label}</Badge> : null}
                        {m?.treatment ? <Badge tone="special">{m.treatment === 'HARDEN' ? 'Hardened' : m.treatment}</Badge> : null}
                        {m?.propertyClass ? <Badge tone="special">G{m.propertyClass}</Badge> : null}
                        {item.finishLabel ? <Badge tone="neutral">{item.finishLabel}</Badge> : null}
                    </div>
                ) : null}
                <div className="mt-2 text-sm whitespace-pre-line tabular-nums" data-testid="item-size">
                    {size || '—'}
                </div>
                {item.accessories?.summary ? <div className="mt-1 text-xs text-muted-foreground">With {item.accessories.summary}</div> : null}
                {p.ambiguous ? (
                    <div className="mt-2">
                        <Badge tone="warning">
                            <AlertTriangle aria-hidden="true" /> Accessory charge inside price
                        </Badge>
                    </div>
                ) : null}
            </div>
            <dl className="grid grid-cols-3 gap-x-4 border-t border-border pt-3 text-right text-sm md:min-w-80 md:border-t-0 md:pt-0">
                <div>
                    <dt className="text-xs text-subtle-foreground">Qty</dt>
                    <dd className="tabular-nums">{orDash(item.qty)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-subtle-foreground">Unit price</dt>
                    <dd className="tabular-nums" data-testid="item-unit-price">
                        {formatPrice(p.customerUnitPrice)}
                        {item.unitSuffix}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-subtle-foreground">Amount</dt>
                    <dd className="font-medium tabular-nums">{formatPrice(p.total)}</dd>
                </div>
            </dl>
        </Card>
    );
}

/* "Not recorded", with a short hint behind an info button (hover, focus or tap). */
function NotRecorded({ hint, testId }: { hint: string; testId?: string }) {
    return (
        <span className="inline-flex items-center gap-1.5" data-testid={testId}>
            <span className="text-muted-foreground">Not recorded</span>
            {hint ? (
                <TooltipProvider delayDuration={150}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                aria-label={hint}
                                className="inline-flex size-6 items-center justify-center rounded-full text-subtle-foreground hover:bg-surface-muted hover:text-muted-foreground"
                            >
                                <Info className="size-3.5" aria-hidden="true" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>{hint}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            ) : null}
        </span>
    );
}

function RevisionsSection({ history }: { history: RevisionHistory }) {
    return (
        <section aria-labelledby="history-heading" className="mt-5">
            <h2 id="history-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
                <Clock className="size-4" aria-hidden="true" /> Revision history
            </h2>
            {history.state === 'ok' ? (
                <ol className="flex flex-col gap-1 text-sm" data-testid="revision-list">
                    {history.entries.map((r) => (
                        <li key={r.revisionNo} className="flex flex-wrap gap-x-2">
                            <span className="font-medium">#{r.revisionNo}</span>
                            <span>{r.event === 'create' ? 'Created' : r.event === 'update' ? 'Updated' : r.event}</span>
                            <span className="text-muted-foreground">
                                by {r.actor.displayName ?? r.actor.username ?? 'unknown'} · {r.createdAt ?? '—'}
                            </span>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="text-sm text-muted-foreground" data-testid="revision-state" data-state={history.state}>
                    {history.state === 'empty'
                        ? 'No revisions recorded. Quotations saved before revision history existed have none.'
                        : 'Revision history could not be read just now.'}
                </p>
            )}
        </section>
    );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-subtle-foreground">{label}</div>
            <div className="mt-0.5 whitespace-pre-line text-sm">{children}</div>
        </div>
    );
}

function Notice({ icon, children, testId }: { icon: ReactNode; children: ReactNode; testId?: string }) {
    return (
        <div role="status" data-testid={testId} className="mb-2 flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm shadow-xs">
            {icon}
            <div>{children}</div>
        </div>
    );
}
