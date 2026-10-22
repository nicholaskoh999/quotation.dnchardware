import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { computeItem, type ComputedItem, type FieldKey } from '@/builder/compute';
import { emptyDimensions, emptyItem, newUid, type DraftItem, type ItemDimensions } from '@/builder/model';
import { BATCH_ADD_PRODUCTS, SIZE_OPTIONS, specFor, type BuilderProduct } from '@/builder/products';
import { formatPrice } from '@/components/legacy/format';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { Combobox } from './combobox';
import { Field, SectionTitle, TextInput } from './fields';
import { TaskBody, TaskDialog } from './task-dialog';
import { AccessoriesFields, IdentityFields, type ErrFn } from './item-fields';
import { Kbd, keyBelongsToField, modKeyLabel } from './item-editor';

/* Batch Add — common fields once, then several similar rows. (Owner Smoke #2:
   this grouped row form is NOT Quick Add — Quick Add is AI-assisted
   extraction from text / image / PDF, see quick-add.tsx.) The group fixes
   Product · Material · Treatment · Size Type · Finish · accessories · pricing
   defaults; each row is Size · dimensions · Qty (Qty starts at 1). Every row
   becomes the SAME DraftItem a Manual Add would create (entryMode 'batch'),
   priced by the same engine call.

   Built for 20–30 rows (Loop #2): the rows scroll inside the dialog body,
   plain Enter moves to the next cell (then the next row's Size, adding a row
   after the last) and never submits; Ctrl/⌘+Enter adds every valid row. Any
   row that needs attention blocks the add; blank rows are ignored. */

interface BatchRow {
    key: string;
    size: string;
    dims: Partial<ItemDimensions>;
    qty: string;
}

const blankRow = (): BatchRow => ({ key: newUid(), size: '', dims: {}, qty: '1' });

/** A row with no size and no dimensions is ignored (its default Qty 1 is not an entry). */
function rowIsBlank(r: BatchRow): boolean {
    return !r.size.trim() && Object.values(r.dims).every((v) => !String(v ?? '').trim());
}

export function rowToItem(group: DraftItem, row: BatchRow): DraftItem {
    return {
        ...group,
        uid: newUid(),
        entryMode: 'batch',
        size: row.size,
        dims: { ...emptyDimensions(), ...row.dims },
        qty: row.qty,
        accessories: JSON.parse(JSON.stringify(group.accessories)),
        pricing: { ...group.pricing },
    };
}

function initialGroup(product: BuilderProduct): DraftItem {
    return emptyItem(product, 'batch');
}

export function BatchAdd({
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
    const startProduct: BuilderProduct = initialProduct && BATCH_ADD_PRODUCTS.includes(initialProduct) ? initialProduct : 'sagrod';
    const [group, setGroup] = useState<DraftItem>(() => initialGroup(startProduct));
    const [rows, setRows] = useState<BatchRow[]>(() => [blankRow(), blankRow(), blankRow()]);
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
            document.getElementById(`ba-${focusKey.current}-size`)?.focus();
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
    const ready = filled.length - invalid.length;
    const readyTotal = filled.reduce((sum, r) => sum + (r.computed!.valid && r.computed!.pricing ? r.computed!.pricing.totalAmount : 0), 0);
    const mod = useMemo(modKeyLabel, []);

    const setRow = (key: string, patch: Partial<BatchRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, dims: { ...r.dims, ...(patch.dims ?? {}) } } : r)));
    /** focus = keyboard flow (Enter after the last cell). The + Row button keeps focus on
        itself, so repeated clicks are never covered by the new row's size suggestions. */
    const addRow = (focus = true) => {
        const r = blankRow();
        if (focus) focusKey.current = r.key;
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

    /* Enter → next cell (next row's Size after Qty; a new row after the last).
       Ctrl/⌘+Enter → add all. Plain Enter never submits. */
    const formRef = useRef<HTMLFormElement>(null);
    const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.altKey) return;
        if (e.repeat) {
            e.preventDefault();
            return;
        }
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            submit();
            return;
        }
        if (keyBelongsToField(e)) return; // incl. a combobox that just picked an option
        e.preventDefault();
        const cells = Array.from(formRef.current?.querySelectorAll<HTMLElement>('[data-ba-cell], [data-ba-size] input') ?? []);
        const at = cells.indexOf(e.target as HTMLElement);
        if (at === -1) return; // a group field: Enter just stays put
        const next = cells[at + 1];
        if (next) {
            next.focus();
            if (next instanceof HTMLInputElement) next.select();
        } else addRow();
    };

    const cellErr = (c: ComputedItem | null, r: BatchRow, f: FieldKey): string | undefined => {
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
        <TaskDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Batch Add"
            description="Set common fields once, then enter multiple similar rows."
            width={1040}
            testId="batch-add"
            footer={
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <p className={cn('min-w-0 text-sm tabular-nums', invalid.length ? 'text-warning' : 'text-muted-foreground')} data-testid="ba-status" aria-live="polite">
                        {filled.length === 0 ? (
                            'No rows yet'
                        ) : invalid.length ? (
                            <>
                                <span className="text-foreground">{ready} ready</span> · <span className="font-medium">{invalid.length} need{invalid.length === 1 ? 's' : ''} attention</span>
                            </>
                        ) : (
                            <>
                                {ready} valid row{ready === 1 ? '' : 's'} · Total <span className="font-semibold text-foreground">{formatPrice(readyTotal)}</span>
                            </>
                        )}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="ghost" className="px-3" onClick={() => onOpenChange(false)}>
                            Cancel <Kbd>Esc</Kbd>
                        </Button>
                        <Button
                            type="submit"
                            form="batch-add-form"
                            variant="primary"
                            className="flex-1 aria-disabled:opacity-60 sm:flex-none"
                            data-testid="ba-submit"
                            disabled={filled.length === 0}
                            aria-disabled={invalid.length > 0 || undefined}
                            title={invalid.length ? 'Fix the rows that need attention first' : undefined}
                        >
                            Add {filled.length || ''} item{filled.length === 1 ? '' : 's'} <Kbd>{`${mod}+Enter`}</Kbd>
                        </Button>
                    </div>
                </div>
            }
        >
                <form
                    ref={formRef}
                    id="batch-add-form"
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    onKeyDown={onKeyDown}
                    noValidate
                >
                    <TaskBody>
                        <div className="flex flex-col gap-6">
                            <section className="flex flex-col gap-3" data-testid="ba-group">
                                <SectionTitle aside={<span className="text-xs text-muted-foreground">Applies to every row</span>}>Group</SectionTitle>
                                <IdentityFields prefix="ba" item={group} computed={groupComputed} onChange={(g) => setGroup({ ...g, entryMode: 'batch' })} err={groupErr} products={BATCH_ADD_PRODUCTS} />
                                <div className="grid grid-cols-3 gap-3 sm:max-w-md">
                                    <Field id="ba-costRate" label="Cost rate" hint={groupComputed.suggested.costRate !== null ? 'Default per row' : 'No default — enter it'} error={groupErr('costRate')}>
                                        <TextInput
                                            id="ba-costRate"
                                            inputMode="decimal"
                                            value={group.pricing.costRate ?? ''}
                                            placeholder={groupComputed.suggested.costRate !== null ? 'auto' : ''}
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, costRate: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                    <Field id="ba-addCost" label="Add. cost" hint="Default per row">
                                        <TextInput
                                            id="ba-addCost"
                                            inputMode="decimal"
                                            value={group.pricing.addCost ?? ''}
                                            placeholder="auto"
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, addCost: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                    <Field id="ba-markup" label="Markup %">
                                        <TextInput
                                            id="ba-markup"
                                            inputMode="decimal"
                                            value={group.pricing.markup ?? ''}
                                            placeholder="0"
                                            onChange={(e) => setGroup({ ...group, pricing: { ...group.pricing, markup: e.target.value === '' ? null : e.target.value } })}
                                        />
                                    </Field>
                                </div>
                                <div>
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">Accessories (qty per item)</p>
                                    <AccessoriesFields prefix="ba" value={group.accessories} onChange={(accessories) => setGroup({ ...group, accessories })} err={groupErr} compact />
                                </div>
                            </section>

                            <section className="flex flex-col gap-2" data-testid="ba-rows">
                                <SectionTitle
                                    aside={
                                        <span className="text-xs text-muted-foreground">
                                            Blank rows are ignored<span className="hidden sm:inline"> · Enter = next cell · {mod}+Enter = add all</span>
                                        </span>
                                    }
                                >
                                    Rows <span className="font-normal text-muted-foreground tabular-nums">({rows.length})</span>
                                </SectionTitle>
                                <div className="hidden gap-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid" style={{ gridTemplateColumns: `1.5rem minmax(6rem,1fr) repeat(${spec.dims.length}, minmax(4.5rem,1fr)) 4.5rem 11rem 2.25rem` }}>
                                    <span>#</span>
                                    <span>Size</span>
                                    {spec.dims.map((d) => (
                                        <span key={d.key}>{d.label}</span>
                                    ))}
                                    <span>Qty</span>
                                    <span className="text-right">Weight · Unit · Total</span>
                                    <span />
                                </div>
                                <ol className="flex flex-col gap-2">
                                    {computedRows.map(({ row, computed: c }, idx) => {
                                        const summary = rowSummary(c);
                                        return (
                                            <li
                                                key={row.key}
                                                className={cn('rounded-[var(--radius-md)] border border-border p-2 md:border-0 md:p-0', c && !c.valid && attempted && 'border-warning md:border-l-2 md:pl-1.5')}
                                                data-testid="ba-row"
                                                data-attention={c && !c.valid ? 'true' : undefined}
                                            >
                                                <div>
                                                    <div className="ba-row-grid gap-2" style={{ ['--ba-cols' as string]: `1.5rem minmax(6rem,1fr) repeat(${spec.dims.length}, minmax(4.5rem,1fr)) 4.5rem 11rem 2.25rem` }}>
                                                        <span className="col-span-2 pt-0 text-xs font-semibold text-muted-foreground tabular-nums md:col-span-1 md:pt-2.5">
                                                            <span className="md:hidden">Row </span>
                                                            {idx + 1}
                                                        </span>
                                                        <div className="col-span-2 md:col-span-1" data-ba-size="">
                                                            <Combobox
                                                                id={`ba-${row.key}-size`}
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
                                                                    data-ba-cell=""
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
                                                                data-ba-cell=""
                                                            />
                                                            <CellError msg={cellErr(c, row, 'qty')} />
                                                        </div>
                                                        <div className="col-span-2 flex items-center justify-between gap-2 text-sm tabular-nums md:col-span-1 md:block md:pt-2 md:text-right" data-testid="ba-row-preview">
                                                            {c?.pricing && c.pricing.finalUnitPrice > 0 ? (
                                                                <>
                                                                    <span className="text-xs text-subtle-foreground md:block" data-testid="ba-row-weight">
                                                                        {c.lineWeight !== null && c.lineWeight > 0 ? `${c.lineWeight.toFixed(3)} kg` : c.unitWeight > 0 ? `${c.unitWeight.toFixed(3)} kg/pc` : ''}
                                                                    </span>
                                                                    <span className="text-muted-foreground" data-testid="ba-row-unit">{formatPrice(c.pricing.finalUnitPrice)}</span>
                                                                    <span className="font-semibold md:ml-2" data-testid="ba-row-total">{c.pricing.totalAmount > 0 ? formatPrice(c.pricing.totalAmount) : '—'}</span>
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
                                    <Button type="button" variant="secondary" size="sm" onClick={() => addRow(false)} data-testid="ba-add-row">
                                        <Plus aria-hidden="true" /> Row
                                    </Button>
                                </div>
                            </section>
                        </div>
                    </TaskBody>
                </form>
        </TaskDialog>
    );
}

function CellError({ msg }: { msg?: string }) {
    return msg ? (
        <p role="alert" className="mt-0.5 text-xs leading-tight text-danger">
            {msg}
        </p>
    ) : null;
}
