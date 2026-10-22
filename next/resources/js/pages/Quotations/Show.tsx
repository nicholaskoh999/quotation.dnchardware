import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, ArrowLeft, Clock, FileWarning, Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DataSourceNotice, ReadOnlyNote } from '@/components/legacy/data-source-notice';
import {
    formatDate,
    formatDimensions,
    formatMarkup,
    formatPrice,
    formatStoredMoney,
    formatWeight,
    groupItems,
    itemIdentity,
    lineWeight,
    orDash,
    type ItemGroup,
    type ItemOrder,
} from '@/components/legacy/format';
import { OrderToggle, PageHeader } from '@/components/legacy/read-parts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { QuotationDetail, QuotationShowProps, ReadableItem, RevisionHistory } from '@/types/legacy';

/* A saved legacy quotation, read only, for INTERNAL use: header, the items
   grouped by Product + Size Type (insertion order is the item number and is
   never changed), per item the dimensions + Qty, accessories, weight and the
   customer unit price with its markup badge, then the total AS SAVED. No
   Edit / Delete / Save; Cost Rate and Additional Cost never reach the page.
   No UOM: the system has no canonical UOM field yet (Wave 2 Builder). */
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

const ITEM_ORDER_OPTIONS = [
    { value: 'oldest' as const, label: 'Oldest first' },
    { value: 'newest' as const, label: 'Newest first' },
];

function ItemsSection({ q }: { q: QuotationDetail }) {
    // Default = the historical order (item #1 first). Display order only.
    const [order, setOrder] = useState<ItemOrder>('oldest');
    const groups = groupItems(q.items, order);
    return (
        <section aria-labelledby="items-heading" className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="items-heading" className="text-base font-semibold">
                    Items <span className="font-normal text-muted-foreground">({q.itemCount})</span>
                </h2>
                {q.items.length > 1 ? (
                    <OrderToggle label="Item order" value={order} options={ITEM_ORDER_OPTIONS} onChange={setOrder} testId="item-order" />
                ) : null}
            </div>
            {q.itemsState === 'unreadable' ? (
                <Notice icon={<FileWarning className="size-5 text-danger" aria-hidden="true" />} testId="items-unreadable">
                    The items saved with this quotation could not be read. The saved total below is still the quotation’s total.
                </Notice>
            ) : null}
            {q.itemsState === 'empty' || q.itemsState === 'missing' ? (
                <Notice icon={<Info className="size-5 text-subtle-foreground" aria-hidden="true" />}>No items were saved with this quotation.</Notice>
            ) : null}
            <div className="flex flex-col gap-3" data-testid="quotation-items">
                {groups.map((g) => (
                    <ItemGroupSection key={g.key} group={g} />
                ))}
            </div>
        </section>
    );
}

/* One Product + Size Type group: a plain-text header, then compact rows. */
function ItemGroupSection({ group }: { group: ItemGroup }) {
    const only = group.items.length === 1 ? group.items[0]! : null;
    if (only && only.state === 'unreadable') {
        return (
            <Notice icon={<AlertTriangle className="size-5 text-warning" aria-hidden="true" />} testId="item-unreadable">
                <span className="font-medium">Item {only.position}</span> — {only.reason}
            </Notice>
        );
    }
    const n = group.items.length;
    return (
        <Card data-testid="item-group" className="overflow-hidden">
            {/* Shared material + finish: one natural heading (`MS UNDERSIZE SAG ROD · ZP`).
                Mixed: Size Type + Product only, each row names its own material · finish. */}
            <div className="flex items-baseline justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-2.5 sm:px-5">
                <h3 className="min-w-0 text-sm font-semibold tracking-wide" data-testid="group-title">
                    {group.heading}
                </h3>
                <span className="shrink-0 text-xs text-muted-foreground" data-testid="group-meta">
                    {`${n} item${n === 1 ? '' : 's'}`}
                </span>
            </div>
            <ul className="divide-y divide-border">
                {group.items.map((item) =>
                    item.state === 'ok' ? (
                        <ItemRow key={item.position} item={item} showIdentity={group.sharedIdentity === null} />
                    ) : (
                        <li key={item.position} className="flex gap-3 px-4 py-3 text-sm sm:px-5" data-testid="item-unreadable">
                            <span className="w-8 shrink-0 font-medium text-muted-foreground tabular-nums">#{item.position}</span>
                            <span className="text-muted-foreground">{item.reason}</span>
                        </li>
                    ),
                )}
            </ul>
            {group.totalWeight !== null ? (
                <div className="flex justify-end border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5" data-testid="group-total-weight">
                    Total Weight <span className="ml-1.5 font-semibold text-foreground tabular-nums">{formatWeight(group.totalWeight)}</span>
                </div>
            ) : null}
        </Card>
    );
}

/* Item row, owner-approved order:
     (material · finish, only when it differs within the group)
     1  #n  dimensions · Qty n          (no UOM)
     2  + accessories                   (only when present)
     3  Weight x.xxx kg                 (per-piece weight × qty, as the legacy card)
     4  Unit RMx.xx  ⭐ +5% | Manual      Total RMx.xx */
function ItemRow({ item, showIdentity }: { item: ReadableItem; showIdentity: boolean }) {
    const p = item.pricing;
    // Multi-line sizes (Welding Anchor Sets): Qty follows the first line; the
    // component lines sit beneath it.
    const [sizeHead = '', ...sizeRest] = formatDimensions(item.sizeLabel).split('\n');
    const identity = showIdentity ? itemIdentity(item) : '';
    const weight = lineWeight(item);
    return (
        <li className="flex gap-3 px-4 py-3.5 sm:px-5" data-testid="item-row" data-position={item.position}>
            <span className="w-8 shrink-0 pt-px text-sm font-semibold text-muted-foreground tabular-nums" data-testid="item-number">
                #{item.position}
            </span>
            {/* Four levels, same on every width: dimensions · Qty / accessories /
                Weight / price row. A readable measure on wide screens keeps the
                price row from stretching into an accounting line. */}
            <div className="min-w-0 flex-1 space-y-1 text-sm md:max-w-2xl">
                {identity ? (
                    <div className="font-medium" data-testid="item-identity">
                        {identity}
                    </div>
                ) : null}
                <div className="flex flex-wrap gap-x-1.5" data-testid="item-line">
                    <span className="tabular-nums" data-testid="item-size">
                        {sizeHead || '—'}
                    </span>
                    <span className="text-muted-foreground" aria-hidden="true">
                        ·
                    </span>
                    <span className="whitespace-nowrap tabular-nums" data-testid="item-qty">
                        Qty {orDash(item.qty)}
                    </span>
                </div>
                {sizeRest.length > 0 ? (
                    <div className="-mt-0.5 whitespace-pre-line text-muted-foreground tabular-nums" data-testid="item-size-detail">
                        {sizeRest.join('\n')}
                    </div>
                ) : null}
                {item.accessories?.summary ? (
                    <div className="text-muted-foreground" data-testid="item-accessories">
                        + {item.accessories.summary}
                    </div>
                ) : null}
                {weight !== null ? (
                    <div className="text-xs text-muted-foreground" data-testid="item-weight">
                        Weight <span className="tabular-nums">{formatWeight(weight)}</span>
                    </div>
                ) : null}
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-1" data-testid="item-price">
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                        <span className="text-muted-foreground">
                            Unit{' '}
                            <span className="font-medium text-foreground tabular-nums" data-testid="item-unit-price">
                                {formatPrice(p.customerUnitPrice)}
                                {item.unitSuffix}
                            </span>
                        </span>
                        {p.manual ? (
                            <span className="text-xs font-medium text-muted-foreground" data-testid="item-manual">
                                Manual
                            </span>
                        ) : p.markupPercent ? (
                            <span className="text-xs font-medium text-muted-foreground" data-testid="item-markup" title="Markup on the calculated price">
                                <span aria-hidden="true">⭐ </span>
                                {formatMarkup(p.markupPercent)}
                            </span>
                        ) : null}
                        {p.ambiguous ? (
                            <Badge tone="warning">
                                <AlertTriangle aria-hidden="true" /> Accessory charge inside price
                            </Badge>
                        ) : null}
                    </div>
                    <span className="text-muted-foreground">
                        Total{' '}
                        <span className="text-base font-semibold text-foreground tabular-nums" data-testid="item-total">
                            {formatPrice(p.total)}
                        </span>
                    </span>
                </div>
            </div>
        </li>
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
