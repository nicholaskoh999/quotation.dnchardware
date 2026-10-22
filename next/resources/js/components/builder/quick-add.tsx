import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { computeItem, type ComputedItem, type FieldKey } from '@/builder/compute';
import { emptyDimensions, emptyItem, newUid, type DraftItem, type ItemDimensions } from '@/builder/model';
import { QUICK_ADD_PRODUCTS, SIZE_OPTIONS, specFor, type BuilderProduct } from '@/builder/products';
import { formatPrice } from '@/components/legacy/format';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { notify } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { Combobox } from './combobox';
import { Field, SectionTitle, SheetHeading, TextInput } from './fields';
import { AccessoriesFields, IdentityFields, type ErrFn } from './item-fields';

/* Quick Add (Session E §8) — fast structured entry for known DNC products.
   Group first, row exceptions second (handoff §25): the group fixes Product ·
   Material · Size Type · Finish · accessories · pricing defaults; each row is
   just Size · dimensions · Qty. Every row becomes the SAME DraftItem a Manual
   Add would create (entryMode 'quick'), priced by the same engine call.
   Text / WhatsApp image / PDF analysis is Wave 3 Session I. */

interface QuickRow {
    key: string;
    size: string;
    dims: Partial<ItemDimensions>;
    qty: string;
}

const blankRow = (): QuickRow => ({ key: newUid(), size: '', dims: {}, qty: '' });

function rowIsBlank(r: QuickRow): boolean {
    return !r.size.trim() && !r.qty.trim() && Object.values(r.dims).every((v) => !String(v ?? '').trim());
}

export function rowToItem(group: DraftItem, row: QuickRow): DraftItem {
    return {
        ...group,
        uid: newUid(),
        entryMode: 'quick',
        size: row.size,
        dims: { ...emptyDimensions(), ...row.dims },
        qty: row.qty,
        accessories: JSON.parse(JSON.stringify(group.accessories)),
        pricing: { ...group.pricing },
    };
}

function initialGroup(product: BuilderProduct): DraftItem {
    return emptyItem(product, 'quick');
}

export function QuickAdd({
    open,
    onOpenChange,
    initialProduct,
    onAdd,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialProduct?: BuilderProduct;
    onAdd: (items: DraftItem[]) => void;
}) {
    const startProduct: BuilderProduct = initialProduct && QUICK_ADD_PRODUCTS.includes(initialProduct) ? initialProduct : 'sagrod';
    const [group, setGroup] = useState<DraftItem>(() => initialGroup(startProduct));
    const [rows, setRows] = useState<QuickRow[]>(() => [blankRow(), blankRow(), blankRow()]);
    const [attempted, setAttempted] = useState(false);
    const focusKey = useRef<string | null>(null);

    useEffect(() => {
        if (open) {
            setGroup(initialGroup(startProduct));
            setRows([blankRow(), blankRow(), blankRow()]);
            setAttempted(false);
        }
    }, [open, startProduct]);

    useEffect(() => {
        if (focusKey.current) {
            document.getElementById(`qa-${focusKey.current}-size`)?.focus();
            focusKey.current = null;
        }
    });

    const spec = specFor(group.product);
    // The group is validated as a whole item with placeholder row values, so a
    // group-level problem (property class, finish…) is reported once on the group.
    const groupComputed = useMemo(() => computeItem({ ...group, size: 'M12', qty: '1' }), [group]);
    const groupErr: ErrFn = (f) => (['propertyClass', 'finish', 'sizeType', 'nut', 'fw', 'custom', 'costRate', 'addCost', 'markup'].includes(f) ? groupComputed.errors[f] : undefined) as string | undefined;

    const computedRows = useMemo(
        () => rows.map((r) => ({ row: r, blank: rowIsBlank(r), computed: rowIsBlank(r) ? null : computeItem(rowToItem(group, r)) })),
        [rows, group],
    );
    const filled = computedRows.filter((r) => !r.blank);
    const invalid = filled.filter((r) => !r.computed!.valid);

    const setRow = (key: string, patch: Partial<QuickRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dims: { ...r.dims, ...(patch.dims ?? {}) } } : r)));
    const addRow = () => {
        const r = blankRow();
        focusKey.current = r.key;
        setRows((rs) => [...rs, r]);
    };

    const submit = () => {
        if (filled.length === 0) {
            notify.error('Enter at least one row');
            return;
        }
        if (invalid.length > 0) {
            setAttempted(true);
            notify.error(`Fix ${invalid.length} row${invalid.length === 1 ? '' : 's'} before adding`);
            return;
        }
        onAdd(filled.map((r) => ({ ...r.computed!.item })));
    };

    const cellErr = (c: ComputedItem | null, r: QuickRow, f: FieldKey): string | undefined => {
        if (!c) return undefined;
        const touched = f === 'size' ? r.size.trim() !== '' : f === 'qty' ? r.qty.trim() !== '' : String(r.dims[f as keyof ItemDimensions] ?? '').trim() !== '';
        return attempted || touched ? c.errors[f] : undefined;
    };

    const rowSummary = (c: ComputedItem | null) => {
        if (!c) return null;
        const other = Object.entries(c.errors).filter(([k]) => !['size', 'qty', 'diameter', ...spec.dims.map((d) => d.key)].includes(k));
        return { other: other.map(([, v]) => v) };
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                title="Quick Add"
                description="Choose the group once, then type the rows."
                hideTitle
                className="w-full max-w-none gap-0 p-0 sm:w-[min(64rem,96vw)]"
                data-testid="quick-add"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <SheetHeading title="Quick Add" description="Choose the group once, then type the rows. Every row becomes the same item a Manual Add would." />
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    noValidate
                >
                    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 sm:px-6">
                        <div className="flex flex-col gap-6">
                            <section className="flex flex-col gap-3" data-testid="qa-group">
                                <SectionTitle aside={<span className="text-xs text-muted-foreground">Applies to every row</span>}>Group</SectionTitle>
                                <IdentityFields prefix="qa" item={group} computed={groupComputed} onChange={(g) => setGroup({ ...g, entryMode: 'quick' })} err={groupErr} products={QUICK_ADD_PRODUCTS} />
                                <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                                    <Field id="qa-costRate" label="Cost rate" hint={groupComputed.suggested.costRate !== null ? 'Default per row' : 'No default — enter it'} error={groupErr('costRate')}>
                                        <TextInput
                                            id="qa-costRate"
                                            inputMode="decimal"
                                            value={group.pricing.costRate ?? ''}
                                            placeholder={groupComputed.suggested.costRate !== null ? 'auto' : ''}
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, costRate: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                    <Field id="qa-addCost" label="Add. cost" hint="Default per row">
                                        <TextInput
                                            id="qa-addCost"
                                            inputMode="decimal"
                                            value={group.pricing.addCost ?? ''}
                                            placeholder="auto"
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, addCost: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                    <Field id="qa-markup" label="Markup %">
                                        <TextInput
                                            id="qa-markup"
                                            inputMode="decimal"
                                            value={group.pricing.markup ?? ''}
                                            placeholder="0"
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, markup: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">Accessories (qty per item)</p>
                                    <AccessoriesFields prefix="qa" value={group.accessories} onChange={(accessories) => setGroup({ ...group, accessories })} err={groupErr} compact />
                                </div>
                            </section>

                            <section className="flex flex-col gap-2" data-testid="qa-rows">
                                <SectionTitle aside={<span className="text-xs text-muted-foreground">Blank rows are ignored</span>}>Rows</SectionTitle>
                                <div className="hidden gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ gridTemplateColumns: `1.5rem minmax(6rem,1fr) repeat(${spec.dims.length}, minmax(4.5rem,1fr)) 4.5rem 9rem 2.25rem` }}>
                                    <span>#</span>
                                    <span>Size</span>
                                    {spec.dims.map((d) => (
                                        <span key={d.key}>{d.label}</span>
                                    ))}
                                    <span>Qty</span>
                                    <span className="text-right">Unit · Total</span>
                                    <span />
                                </div>
                                <ol className="flex flex-col gap-2">
                                    {computedRows.map(({ row, computed: c }, idx) => {
                                        const summary = rowSummary(c);
                                        return (
                                            <li key={row.key} className="rounded-[var(--radius-md)] border border-border p-2 md:border-0 md:p-0" data-testid="qa-row">
                                                <div>
                                                    <div className="qa-row-grid gap-2" style={{ ['--qa-cols' as string]: `1.5rem minmax(6rem,1fr) repeat(${spec.dims.length}, minmax(4.5rem,1fr)) 4.5rem 9rem 2.25rem` }}>
                                                        <span className="col-span-2 pt-0 text-xs font-semibold text-muted-foreground tabular-nums md:col-span-1 md:pt-2.5">
                                                            <span className="md:hidden">Row </span>
                                                            {idx + 1}
                                                        </span>
                                                        <div className="col-span-2 md:col-span-1">
                                                            <Combobox
                                                                id={`qa-${row.key}-size`}
                                                                aria-label={`Row ${idx + 1} size`}
                                                                aria-invalid={cellErr(c, row, 'size') || cellErr(c, row, 'diameter') ? true : undefined}
                                                                value={row.size}
                                                                onChange={(v) => setRow(row.key, { size: v })}
                                                                options={SIZE_OPTIONS}
                                                                placeholder="Size"
                                                            />
                                                            <CellError msg={cellErr(c, row, 'size') ?? cellErr(c, row, 'diameter')} />
                                                        </div>
                                                        {spec.dims.map((d) => (
                                                            <div key={d.key}>
                                                                <TextInput
                                                                    aria-label={`Row ${idx + 1} ${d.label}`}
                                                                    aria-invalid={cellErr(c, row, d.key as FieldKey) ? true : undefined}
                                                                    inputMode={d.kind === 'tl' ? 'text' : 'decimal'}
                                                                    placeholder={d.label + (d.required ? '' : ' (opt.)')}
                                                                    value={row.dims[d.key] ?? ''}
                                                                    onChange={(e) => setRow(row.key, { dims: { [d.key]: e.target.value } })}
                                                                />
                                                                <CellError msg={cellErr(c, row, d.key as FieldKey)} />
                                                            </div>
                                                        ))}
                                                        <div>
                                                            <TextInput
                                                                aria-label={`Row ${idx + 1} Qty`}
                                                                aria-invalid={cellErr(c, row, 'qty') ? true : undefined}
                                                                inputMode="numeric"
                                                                placeholder="Qty"
                                                                value={row.qty}
                                                                onChange={(e) => setRow(row.key, { qty: e.target.value })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && idx === rows.length - 1) {
                                                                        e.preventDefault();
                                                                        addRow();
                                                                    }
                                                                }}
                                                            />
                                                            <CellError msg={cellErr(c, row, 'qty')} />
                                                        </div>
                                                        <div className="col-span-2 flex items-center justify-between gap-2 text-sm tabular-nums md:col-span-1 md:block md:pt-2 md:text-right" data-testid="qa-row-preview">
                                                            {c?.pricing && c.pricing.finalUnitPrice > 0 ? (
                                                                <>
                                                                    <span className="text-muted-foreground">{formatPrice(c.pricing.finalUnitPrice)}</span>
                                                                    <span className="font-semibold md:ml-2">{c.pricing.totalAmount > 0 ? formatPrice(c.pricing.totalAmount) : '—'}</span>
                                                                </>
                                                            ) : (
                                                                <span className="text-subtle-foreground">—</span>
                                                            )}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={`Remove row ${idx + 1}`}
                                                            className="hidden md:inline-flex"
                                                            onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== row.key) : [blankRow()]))}
                                                        >
                                                            <Trash2 aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                    {summary && summary.other.length > 0 && attempted ? (
                                                        <p className="mt-1 text-xs text-danger" role="alert">
                                                            {summary.other.join(' · ')}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                                <div>
                                    <Button type="button" variant="secondary" size="sm" onClick={addRow} data-testid="qa-add-row">
                                        <Plus aria-hidden="true" /> Row
                                    </Button>
                                </div>
                            </section>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                        <p className={cn('text-sm', invalid.length ? 'text-danger' : 'text-muted-foreground')} data-testid="qa-status">
                            {filled.length === 0
                                ? 'No rows yet'
                                : `${filled.length} row${filled.length === 1 ? '' : 's'}${invalid.length ? ` · ${invalid.length} to fix` : ' ready'}`}
                        </p>
                        <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" data-testid="qa-submit" disabled={filled.length === 0}>
                                Add {filled.length || ''} item{filled.length === 1 ? '' : 's'}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}

function CellError({ msg }: { msg?: string }) {
    return msg ? (
        <p role="alert" className="mt-0.5 text-xs leading-tight text-danger">
            {msg}
        </p>
    ) : null;
}
