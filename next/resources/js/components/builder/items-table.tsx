import { ArrowDown, ArrowUp, CircleAlert, Copy, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import type { ComputedItem } from '@/builder/compute';
import { formatDimensions, formatPrice } from '@/components/legacy/format';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/* The quotation's items while it is being built — the same aligned-grid
   language as the accepted W1 detail (one element per item, grid areas in
   app.css .bd-*): desktop # · Item · Qty · Weight · Unit · Markup · Total · ⋯;
   phone a structured three-row card. Item number = position (insertion
   order); it only changes when the person moves an item. No UOM — Qty is the
   bare number. */

/** `+ 4 Nut ZP + 4 FW ZP` from the engine-resolved accessories (blank qty already defaulted, an explicit 0 prints nothing). */
function accessoriesLine(c: ComputedItem): string {
    const a = c.pricing?.accessories;
    if (!a) return '';
    const parts: string[] = [];
    if (a.nut.enabled && a.nut.qty > 0) parts.push([`${a.nut.qty} Nut`, a.nut.finish].filter(Boolean).join(' '));
    if (a.fw.enabled && a.fw.qty > 0) parts.push([`${a.fw.qty} FW`, a.fw.finish].filter(Boolean).join(' '));
    if (a.custom.enabled && a.custom.text.trim()) parts.push(a.custom.text.trim());
    return parts.length ? `+ ${parts.join(' + ')}` : '';
}

export function ItemsTable({
    items,
    onEdit,
    onDuplicate,
    onMove,
    onRemove,
}: {
    items: ComputedItem[];
    onEdit: (index: number) => void;
    onDuplicate: (index: number) => void;
    onMove: (index: number, dir: -1 | 1) => void;
    onRemove: (index: number) => void;
}) {
    return (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs" role="table" aria-label="Quotation items" data-testid="builder-items">
            <div role="row" className="bd-row hidden border-b border-border bg-surface-muted px-4 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid lg:px-5">
                <span role="columnheader" className="bd-num">
                    #
                </span>
                <span role="columnheader" className="bd-item">
                    Item
                </span>
                <span role="columnheader" className="bd-qty text-right">
                    Qty
                </span>
                <span role="columnheader" className="bd-weight text-right">
                    Weight
                </span>
                <span role="columnheader" className="bd-unit text-right">
                    Unit
                </span>
                <span role="columnheader" className="bd-markup text-right">
                    Markup
                </span>
                <span role="columnheader" className="bd-total text-right">
                    Total
                </span>
                <span role="columnheader" className="bd-menu sr-only">
                    Actions
                </span>
            </div>
            <div className="divide-y divide-border">
                {items.map((c, i) => {
                    const p = c.pricing;
                    const n = i + 1;
                    const issues = Object.keys(c.errors).length;
                    const acc = accessoriesLine(c);
                    const markup = Number(c.effective.markup) || 0;
                    return (
                        <div key={c.item.uid} role="row" className={cn('bd-row px-4 py-3 text-sm lg:px-5', !c.valid && 'bg-danger-soft/40')} data-testid="builder-item" data-uid={c.item.uid}>
                            <span role="cell" className="bd-num pt-px font-semibold text-muted-foreground tabular-nums" data-testid="builder-item-number">
                                {n}
                            </span>
                            <div role="cell" className="bd-item min-w-0">
                                <button type="button" onClick={() => onEdit(i)} className="text-left font-medium text-foreground hover:text-accent hover:underline" data-testid="builder-item-title">
                                    {c.title}
                                </button>
                                <div className="text-muted-foreground tabular-nums" data-testid="builder-item-dims">
                                    {c.dimensionLine ? formatDimensions(c.dimensionLine).split('\n')[0] : '—'}
                                </div>
                                {acc ? (
                                    <div className="text-xs text-muted-foreground" data-testid="builder-item-accessories">
                                        {acc}
                                    </div>
                                ) : null}
                                {!c.valid ? (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-danger" data-testid="builder-item-issues">
                                        <CircleAlert className="size-3.5" aria-hidden="true" />
                                        Needs attention · {issues} field{issues === 1 ? '' : 's'}
                                    </p>
                                ) : null}
                            </div>
                            <span role="cell" className="bd-qty whitespace-nowrap tabular-nums md:text-right" data-testid="builder-item-qty">
                                <span className="text-subtle-foreground md:hidden">Qty </span>
                                {c.qty ?? '—'}
                            </span>
                            <span role="cell" className="bd-weight whitespace-nowrap text-muted-foreground tabular-nums md:text-right" data-testid="builder-item-weight">
                                <span className="text-subtle-foreground md:hidden">Weight </span>
                                {c.lineWeight !== null ? `${c.lineWeight.toFixed(3)} kg` : '—'}
                            </span>
                            <span role="cell" className="bd-unit tabular-nums md:text-right" data-testid="builder-item-unit">
                                <span className="text-subtle-foreground md:hidden">Unit </span>
                                <span className="whitespace-nowrap">{p && p.finalUnitPrice > 0 ? formatPrice(p.finalUnitPrice) : '—'}</span>
                            </span>
                            <span role="cell" className="bd-markup text-xs leading-5 whitespace-nowrap text-muted-foreground md:text-right" data-testid="builder-item-markup">
                                {p?.priceMode === 'manual' ? (
                                    <span className="font-medium text-warning">Manual</span>
                                ) : markup > 0 ? (
                                    <span>
                                        <span aria-hidden="true">⭐ </span>+{markup}%
                                    </span>
                                ) : p?.priceMode === 'no_round' ? (
                                    'No round'
                                ) : (
                                    <span className="hidden text-subtle-foreground md:inline">—</span>
                                )}
                            </span>
                            <span role="cell" className="bd-total text-right font-semibold whitespace-nowrap tabular-nums" data-testid="builder-item-total">
                                <span className="font-normal text-subtle-foreground md:hidden">Total </span>
                                {p && p.totalAmount > 0 ? formatPrice(p.totalAmount) : '—'}
                            </span>
                            <div role="cell" className="bd-menu flex justify-end">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label={`Actions for item ${n}`}
                                            className="inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                                            data-testid="builder-item-menu"
                                        >
                                            <Ellipsis className="size-4" aria-hidden="true" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => onEdit(i)}>
                                            <Pencil aria-hidden="true" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onDuplicate(i)}>
                                            <Copy aria-hidden="true" /> Duplicate
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled={i === 0} onSelect={() => onMove(i, -1)}>
                                            <ArrowUp aria-hidden="true" /> Move up
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled={i === items.length - 1} onSelect={() => onMove(i, 1)}>
                                            <ArrowDown aria-hidden="true" /> Move down
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => onRemove(i)} className="text-danger [&_svg]:text-danger">
                                            <Trash2 aria-hidden="true" /> Remove
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
