import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Clock, FileWarning, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import { formatDate, formatPrice, formatStoredMoney, orDash } from '@/components/legacy/format';
import { PageHeader } from '@/components/legacy/read-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FoundationLayout from '@/layouts/foundation-layout';
import type { QuotationDetail, QuotationItem, QuotationShowProps, ReadableItem, RevisionHistory } from '@/types/legacy';

/* A saved legacy quotation, read only: header, the items in their saved order
   (insertion order is the item number), the customer unit price per item and
   the total AS SAVED. No Edit / Delete / Save, and no Cost Rate / Additional
   Cost / Markup — the page payload does not even carry them. */
export default function QuotationShow({ source, quotation, revisions }: QuotationShowProps) {
    return (
        <FoundationLayout>
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
                    <Card className="mt-4">
                        <CardContent className="flex items-baseline justify-between pt-5">
                            <span className="text-sm text-muted-foreground">Quotation total (as saved)</span>
                            <span className="text-lg font-semibold tabular-nums" data-testid="quotation-total">
                                {formatStoredMoney(quotation.totalAmount)}
                            </span>
                        </CardContent>
                    </Card>
                    <RevisionsSection history={revisions} />
                </>
            )}
        </FoundationLayout>
    );
}

function HeaderCard({ q }: { q: QuotationDetail }) {
    return (
        <Card>
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
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
                <Fact label="Prepared by">{orDash(q.preparedBy)}</Fact>
                <Fact label="Issued by">
                    <span className="text-muted-foreground">Not recorded</span>
                    <div className="text-xs text-subtle-foreground">{q.issuerNote}</div>
                </Fact>
                {q.previousRefNo ? <Fact label="Formerly">{q.previousRefNo}</Fact> : null}
                {q.remarks ? (
                    <div className="sm:col-span-2 lg:col-span-3">
                        <Fact label="Remarks">{q.remarks}</Fact>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    );
}

function ItemsSection({ q }: { q: QuotationDetail }) {
    return (
        <section aria-labelledby="items-heading" className="mt-6">
            <h2 id="items-heading" className="mb-3 text-base font-semibold">
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
            <ol className="flex flex-col gap-3" data-testid="quotation-items">
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
    return (
        <Card data-testid="item-card">
            <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-baseline gap-2">
                    <span className="text-muted-foreground">{item.position}.</span>
                    <span>{item.displayDescription || item.productType || 'Item'}</span>
                    {item.finishLabel ? <Badge tone="neutral">{item.finishLabel}</Badge> : null}
                </CardTitle>
                {m && (m.treatment || m.key !== null) ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                        <Badge tone="accent">{m.label}</Badge>
                        {m.treatment ? <Badge tone="special">{m.treatment === 'HARDEN' ? 'Hardened' : m.treatment}</Badge> : null}
                        {m.propertyClass ? <Badge tone="special">G{m.propertyClass}</Badge> : null}
                    </div>
                ) : null}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                    <div className="whitespace-pre-line text-sm">{item.sizeLabel || '—'}</div>
                    {item.accessories?.summary ? (
                        <div className="mt-1 text-xs text-muted-foreground">With {item.accessories.summary}</div>
                    ) : null}
                    {p.ambiguous ? (
                        <div className="mt-2">
                            <Badge tone="warning">
                                <AlertTriangle aria-hidden="true" /> Accessory charge inside price
                            </Badge>
                        </div>
                    ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-x-4 text-right text-sm sm:min-w-72">
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
            </CardContent>
        </Card>
    );
}

function RevisionsSection({ history }: { history: RevisionHistory }) {
    return (
        <section aria-labelledby="history-heading" className="mt-6">
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
        <div role="status" data-testid={testId} className="mb-3 flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm shadow-xs">
            {icon}
            <div>{children}</div>
        </div>
    );
}
