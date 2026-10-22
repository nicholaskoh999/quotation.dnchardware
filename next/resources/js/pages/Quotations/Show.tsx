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
    overallWeight,
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
                    <TotalsSummary q={quotation} />
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

/* ── Item grid (Owner Smoke Loop #4) ─────────────────────────────────────
   One aligned grid for every row, in the spirit of the DNC Workspace
   Activity table: subtle separators, no per-item cards, numeric columns
   right-aligned on a fixed template.
     ≥ md   # · Specification · Qty · Weight · Unit · Markup · Total
     < md   structured three rows with fixed field positions:
              #n  specification (+ secondary lines)
                  Qty n            Weight x kg
                  Unit RMx         ⭐ +n%          Total RMx
   The same cells are placed by grid-template-areas (app.css .qd-row), so
   each item is ONE element at every width. */
// Grid template + areas live in app.css (.qd-row / .qd-*), so Tailwind never
// has to guess dynamic class names.
const ROW_GRID = 'qd-row';
const CELL_NUM = 'qd-num';
const CELL = (area: 'spec' | 'qty' | 'weight' | 'unit' | 'markup' | 'total') =>
    ({ spec: 'qd-spec', qty: 'qd-qty', weight: 'qd-weight', unit: 'qd-unit', markup: 'qd-markup', total: 'qd-total' })[area];
const MOBILE_LABEL = 'text-subtle-foreground md:hidden';

function ItemsSection({ q }: { q: QuotationDetail }) {
    // Default = the historical order (item #1 first). Display order only.
    const [order, setOrder] = useState<ItemOrder>('oldest');
    const groups = groupItems(q.items, order);
    const anyReadable = q.items.some((i) => i.state === 'ok');
    return (
        <section aria-labelledby="items-heading" className="mt-5">
            {/* Sort sits on the Items header row, never inside a group. */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2" data-testid="items-header">
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
            {groups.length > 0 ? (
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs" data-testid="quotation-items" role="table" aria-label="Quotation items">
                    {anyReadable ? (
                        <div
                            role="row"
                            className={`${ROW_GRID} hidden border-b border-border bg-surface-muted px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid lg:px-5`}
                            data-testid="item-grid-header"
                        >
                            <span role="columnheader" className={CELL_NUM}>#</span>
                            <span role="columnheader" className={CELL('spec')}>Specification</span>
                            <span role="columnheader" className={`${CELL('qty')} text-right`}>Qty</span>
                            <span role="columnheader" className={`${CELL('weight')} text-right`}>Weight</span>
                            <span role="columnheader" className={`${CELL('unit')} text-right`}>Unit</span>
                            <span role="columnheader" className={`${CELL('markup')} text-right`}>Markup</span>
                            <span role="columnheader" className={`${CELL('total')} text-right`}>Total</span>
                        </div>
                    ) : null}
                    {groups.map((g) => (
                        <ItemGroupRows key={g.key} group={g} />
                    ))}
                </div>
            ) : null}
        </section>
    );
}

/* One Product + Size Type group: a compact header band, the rows, and a
   Total Weight footer when the group has 2+ items. */
function ItemGroupRows({ group }: { group: ItemGroup }) {
    const n = group.items.length;
    const onlyUnreadable = group.items.every((i) => i.state !== 'ok');
    return (
        <div role="rowgroup" data-testid="item-group" className="border-b border-border last:border-b-0">
            {onlyUnreadable ? null : (
                <div role="row" className="flex items-baseline justify-between gap-3 bg-surface-muted/50 px-4 py-2 lg:px-5">
                    <h3 role="rowheader" className="min-w-0 text-sm font-semibold tracking-wide" data-testid="group-title">
                        {group.heading}
                    </h3>
                    <span className="shrink-0 text-xs text-muted-foreground" data-testid="group-meta">
                        {`${n} item${n === 1 ? '' : 's'}`}
                    </span>
                </div>
            )}
            <div className="divide-y divide-border">
                {group.items.map((item) =>
                    item.state === 'ok' ? (
                        <ItemRow key={item.position} item={item} showIdentity={group.sharedIdentity === null} />
                    ) : (
                        <div key={item.position} role="row" className={`${ROW_GRID} px-4 py-2.5 text-sm lg:px-5`} data-testid="item-unreadable">
                            <span className={`${CELL_NUM} font-medium text-muted-foreground tabular-nums`}>{item.position}</span>
                            <span className={`${CELL('spec')} flex items-start gap-2 text-muted-foreground`}>
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                                <span>
                                    <span className="font-medium text-foreground">Item {item.position}</span> — {item.reason}
                                </span>
                            </span>
                        </div>
                    ),
                )}
            </div>
            {group.totalWeight !== null ? (
                <div role="row" className={`${ROW_GRID} border-t border-border px-4 py-2 text-xs lg:px-5`} data-testid="group-total-weight">
                    <span className={`${CELL('spec')} text-muted-foreground md:text-right`}>Total Weight</span>
                    <span className={`${CELL('weight')} text-right font-semibold whitespace-nowrap text-foreground tabular-nums md:text-right`} data-testid="group-total-weight-value">
                        {formatWeight(group.totalWeight)}
                    </span>
                </div>
            ) : null}
        </div>
    );
}

/* One item: Specification (dimensions, then secondary lines: material ·
   finish when the group is mixed, Welding Anchor Set component lines,
   accessories, the legacy accessory warning) and the aligned figures.
   No UOM: `Qty` is the stored number. */
function ItemRow({ item, showIdentity }: { item: ReadableItem; showIdentity: boolean }) {
    const p = item.pricing;
    // Multi-line sizes (Welding Anchor Sets): the first line is the spec, the
    // component lines are secondary.
    const [sizeHead = '', ...sizeRest] = formatDimensions(item.sizeLabel).split('\n');
    const identity = showIdentity ? itemIdentity(item) : '';
    const weight = lineWeight(item);
    return (
        <div role="row" className={`${ROW_GRID} px-4 py-2.5 text-sm lg:px-5`} data-testid="item-row" data-position={item.position}>
            <span role="cell" className={`${CELL_NUM} font-semibold text-muted-foreground tabular-nums`} data-testid="item-number">
                {item.position}
            </span>
            <div role="cell" className={`${CELL('spec')} min-w-0`} data-testid="item-spec">
                <div className="tabular-nums" data-testid="item-size">
                    {sizeHead || '—'}
                </div>
                {identity ? (
                    <div className="text-xs text-muted-foreground" data-testid="item-identity">
                        {identity}
                    </div>
                ) : null}
                {sizeRest.length > 0 ? (
                    <div className="text-xs whitespace-pre-line text-muted-foreground tabular-nums" data-testid="item-size-detail">
                        {sizeRest.join('\n')}
                    </div>
                ) : null}
                {item.accessories?.summary ? (
                    <div className="text-xs text-muted-foreground" data-testid="item-accessories">
                        + {item.accessories.summary}
                    </div>
                ) : null}
                {p.ambiguous ? (
                    <div className="mt-1">
                        <Badge tone="warning">
                            <AlertTriangle aria-hidden="true" /> Accessory charge inside price
                        </Badge>
                    </div>
                ) : null}
            </div>
            <span role="cell" className={`${CELL('qty')} whitespace-nowrap tabular-nums md:text-right`} data-testid="item-qty">
                <span className={MOBILE_LABEL}>Qty </span>
                {orDash(item.qty)}
            </span>
            <span role="cell" className={`${CELL('weight')} whitespace-nowrap text-muted-foreground tabular-nums md:text-right`} data-testid="item-weight">
                <span className={MOBILE_LABEL}>Weight </span>
                {weight !== null ? formatWeight(weight) : '—'}
            </span>
            <span role="cell" className={`${CELL('unit')} tabular-nums md:text-right md:whitespace-nowrap`} data-testid="item-unit">
                <span className={MOBILE_LABEL}>Unit </span>
                <span className="whitespace-nowrap" data-testid="item-unit-price">
                    {formatPrice(p.customerUnitPrice)}
                    {item.unitSuffix}
                </span>
            </span>
            <span role="cell" className={`${CELL('markup')} text-xs leading-5 whitespace-nowrap text-muted-foreground md:text-right`} data-testid="item-markup-cell">
                {p.manual ? (
                    <span data-testid="item-manual">Manual</span>
                ) : p.markupPercent ? (
                    <span data-testid="item-markup" title="Markup on the calculated price">
                        <span aria-hidden="true">⭐ </span>
                        {formatMarkup(p.markupPercent)}
                    </span>
                ) : (
                    <span className="hidden text-subtle-foreground md:inline" aria-label="No markup">
                        —
                    </span>
                )}
            </span>
            <span role="cell" className={`${CELL('total')} text-right font-semibold whitespace-nowrap tabular-nums`} data-testid="item-total">
                <span className="font-normal text-subtle-foreground md:hidden">Total </span>
                {formatPrice(p.total)}
            </span>
        </div>
    );
}

/* Overall Weight (multi-group quotations only) and the Quotation Total as
   distinct summary rows, outside the item grid. */
function TotalsSummary({ q }: { q: QuotationDetail }) {
    const overall = overallWeight(groupItems(q.items));
    return (
        <Card className="mt-3" data-testid="totals-summary">
            <CardContent className="divide-y divide-border p-0">
                {overall !== null ? (
                    <div className="flex items-baseline justify-between px-4 py-2.5 lg:px-5" data-testid="overall-weight">
                        <span className="text-sm text-muted-foreground">Overall Weight</span>
                        <span className="text-sm font-medium tabular-nums" data-testid="overall-weight-value">
                            {formatWeight(overall)}
                        </span>
                    </div>
                ) : null}
                <div className="flex items-baseline justify-between px-4 py-3 lg:px-5">
                    <span className="text-sm font-medium text-muted-foreground">Quotation Total</span>
                    <span className="text-lg font-semibold tabular-nums" data-testid="quotation-total">
                        {formatStoredMoney(q.totalAmount)}
                    </span>
                </div>
            </CardContent>
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
