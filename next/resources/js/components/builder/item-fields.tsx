import { Plus, RotateCcw, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { MATERIALS, MS_FULLSIZE_HDG_RATE_HINT, PROPERTY_CLASS_OPTIONS, materialHasFinish, type Material, type ProductType } from '@/domain';
import { FINISH_OPTIONS, type ComputedItem, type FieldKey } from '@/builder/compute';
import { emptyItem, type AccessoriesDraft, type DraftItem, type ItemDimensions } from '@/builder/model';
import { BUILDER_PRODUCTS, PLATE_DIMS, SIZE_OPTIONS, productLabel, type DimField } from '@/builder/products';
import { formatDimensions, formatPrice } from '@/components/legacy/format';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { Combobox } from './combobox';
import { Field, Segmented, Select, TextInput } from './fields';

/* Shared item field sections — Manual Add, Edit and the Quick Add group all
   render these, so there is one way to enter each attribute. */

export type ErrFn = (field: FieldKey) => string | undefined;
export type Change = (item: DraftItem) => void;

const SIZE_TYPES = [
    { value: 'FULLSIZE' as const, label: 'Fullsize' },
    { value: 'UNDERSIZE' as const, label: 'Undersize' },
];
const FINISHES = FINISH_OPTIONS.map((f) => ({ value: f, label: f }));

function aria(id: string, error?: string) {
    return { id, 'aria-invalid': error ? (true as const) : undefined, 'aria-describedby': error ? `${id}-error` : undefined };
}

/** Switching product keeps material / finish / qty / accessories; product-specific inputs reset. */
export function switchProduct(item: DraftItem, product: ProductType): DraftItem {
    const fresh = emptyItem(product, item.entryMode);
    return {
        ...fresh,
        uid: item.uid,
        material: item.material,
        treatment: item.treatment,
        propertyClass: item.propertyClass,
        finish: item.finish,
        size: fresh.size,
        qty: item.qty,
        accessories: item.accessories,
        pricing: { ...fresh.pricing, markup: item.pricing.markup },
        sizeType: fresh.sizeType === '' ? '' : item.sizeType || fresh.sizeType,
    };
}

/* ── Identity: product · material · harden · size type · finish ─────────── */
export function IdentityFields({
    prefix,
    item,
    computed,
    onChange,
    err,
    products = BUILDER_PRODUCTS,
    showProduct = true,
}: {
    prefix: string;
    item: DraftItem;
    computed: ComputedItem;
    onChange: Change;
    err: ErrFn;
    products?: readonly ProductType[];
    showProduct?: boolean;
}) {
    const spec = computed.spec;
    const set = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch });
    const customClass = item.treatment === 'HARDEN' && !(PROPERTY_CLASS_OPTIONS as readonly string[]).includes(item.propertyClass);
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {showProduct ? (
                <Field id={`${prefix}-product`} label="Product" required>
                    <Select {...aria(`${prefix}-product`)} value={item.product} onChange={(e) => onChange(switchProduct(item, e.target.value as ProductType))}>
                        {products.map((p) => (
                            <option key={p} value={p}>
                                {productLabel(p)}
                            </option>
                        ))}
                    </Select>
                </Field>
            ) : null}
            {item.product === 'others' ? (
                <Field id={`${prefix}-productName`} label="Product name" required error={err('productName')}>
                    <TextInput {...aria(`${prefix}-productName`, err('productName'))} value={item.productName} onChange={(e) => set({ productName: e.target.value })} placeholder="e.g. SPECIAL BOLT" />
                </Field>
            ) : null}
            <Field id={`${prefix}-material`} label="Material" required>
                <Select
                    {...aria(`${prefix}-material`)}
                    value={item.material}
                    onChange={(e) => {
                        const material = e.target.value as Material;
                        set({ material, finish: materialHasFinish(material) ? item.finish || 'PL' : '' });
                    }}
                >
                    {MATERIALS.map((m) => (
                        <option key={m} value={m}>
                            {m === '4140' ? '4140 (plain, non-QT)' : m}
                        </option>
                    ))}
                </Select>
            </Field>
            <Field id={`${prefix}-treatment`} label="Treatment" error={err('propertyClass')}>
                <div className="flex gap-2">
                    <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm sm:h-10">
                        <input
                            id={`${prefix}-treatment`}
                            type="checkbox"
                            className="size-4 accent-[var(--color-accent)]"
                            checked={item.treatment === 'HARDEN'}
                            onChange={(e) => set({ treatment: e.target.checked ? 'HARDEN' : null, propertyClass: e.target.checked ? item.propertyClass || '8.8' : '' })}
                        />
                        Harden
                    </label>
                    {item.treatment === 'HARDEN' ? (
                        <>
                            <Select
                                aria-label="Property class"
                                aria-invalid={err('propertyClass') ? true : undefined}
                                value={customClass ? 'custom' : item.propertyClass}
                                onChange={(e) => set({ propertyClass: e.target.value === 'custom' ? '' : e.target.value })}
                                className="w-auto"
                                data-testid={`${prefix}-propertyClass`}
                            >
                                {PROPERTY_CLASS_OPTIONS.map((pc) => (
                                    <option key={pc} value={pc}>
                                        G{pc}
                                    </option>
                                ))}
                                <option value="custom">Other…</option>
                            </Select>
                            {customClass ? (
                                <TextInput aria-label="Custom property class" value={item.propertyClass} onChange={(e) => set({ propertyClass: e.target.value })} placeholder="e.g. 14.9" />
                            ) : null}
                        </>
                    ) : null}
                </div>
            </Field>
            {spec.hasSizeType ? (
                <Field id={`${prefix}-sizeType`} label="Size type" required error={err('sizeType')}>
                    <Segmented id={`${prefix}-sizeType`} label="Size type" value={item.sizeType as 'FULLSIZE' | 'UNDERSIZE'} options={SIZE_TYPES} onChange={(v) => set({ sizeType: v })} invalid={!!err('sizeType')} />
                </Field>
            ) : null}
            <Field id={`${prefix}-finish`} label="Finish" required={materialHasFinish(item.material)} error={err('finish')}>
                {materialHasFinish(item.material) ? (
                    <Segmented id={`${prefix}-finish`} label="Finish" value={item.finish as 'PL' | 'ZP' | 'HDG'} options={FINISHES} onChange={(v) => set({ finish: v })} invalid={!!err('finish')} />
                ) : (
                    <p className="flex h-10 items-center text-sm text-muted-foreground" id={`${prefix}-finish`}>
                        N/A — stainless has no finish
                    </p>
                )}
            </Field>
        </div>
    );
}

/* ── Size, diameter, dimensions, developed length, qty ──────────────────── */
export function SizeAndDimensionFields({
    prefix,
    item,
    computed,
    onChange,
    err,
    showQty = true,
}: {
    prefix: string;
    item: DraftItem;
    computed: ComputedItem;
    onChange: Change;
    err: ErrFn;
    showQty?: boolean;
}) {
    const spec = computed.spec;
    const setDim = (key: keyof ItemDimensions, value: string) => onChange({ ...item, dims: { ...item.dims, [key]: value } });
    const set = (patch: Partial<DraftItem>) => onChange({ ...item, ...patch });
    const dims: DimField[] = item.product === 'plate' ? PLATE_DIMS[item.plateType] : spec.dims;
    const g = computed.geometry;
    const needsDiameter = !!err('diameter') || !!computed.errors.size || item.diameterOverride.trim() !== '';
    return (
        <div className="flex flex-col gap-3">
            {item.product === 'plate' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={`${prefix}-plateType`} label="Plate type">
                        <Segmented
                            id={`${prefix}-plateType`}
                            label="Plate type"
                            value={item.plateType}
                            options={[
                                { value: 'ms_plate', label: 'Plate' },
                                { value: 'triangle_plate', label: 'Triangle plate' },
                            ]}
                            onChange={(v) => set({ plateType: v })}
                        />
                    </Field>
                    {item.plateType === 'ms_plate' ? (
                        <Field id={`${prefix}-holes`} label="Holes">
                            <Select id={`${prefix}-holes`} value={item.holeOption} onChange={(e) => set({ holeOption: e.target.value as DraftItem['holeOption'] })}>
                                <option value="none">No holes</option>
                                <option value="center">Centre hole</option>
                                <option value="corners">4 corner holes</option>
                                <option value="custom">Custom number of holes</option>
                            </Select>
                        </Field>
                    ) : null}
                </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {spec.hasSize || item.product === 'others' ? (
                    <Field
                        id={`${prefix}-size`}
                        label="Size"
                        required={spec.hasSize}
                        error={err('size')}
                        warning={computed.warnings.size}
                        hint={computed.size?.label ? `${computed.size.label}${computed.diameter ? ` · Ø${computed.diameter}` : ''}` : 'M12, 12, 1/2 …'}
                        className="col-span-2 sm:col-span-1"
                    >
                        <Combobox
                            {...aria(`${prefix}-size`, err('size'))}
                            value={item.size}
                            onChange={(v) => set({ size: v })}
                            options={SIZE_OPTIONS}
                            placeholder="M12"
                            testId={`${prefix}-size-combobox`}
                        />
                    </Field>
                ) : null}
                {needsDiameter ? (
                    <Field id={`${prefix}-diameter`} label="Bar Ø (mm)" error={err('diameter')} hint="Overrides the built-in table">
                        <TextInput {...aria(`${prefix}-diameter`, err('diameter'))} inputMode="decimal" value={item.diameterOverride} onChange={(e) => set({ diameterOverride: e.target.value })} />
                    </Field>
                ) : null}
                {dims.map((f) => (
                    <Field
                        key={f.key}
                        id={`${prefix}-${f.key}`}
                        label={f.label}
                        required={f.required}
                        error={err(f.key as FieldKey)}
                        hint={f.hint}
                        className={f.kind === 'text' ? 'col-span-2 sm:col-span-4' : undefined}
                    >
                        <TextInput
                            {...aria(`${prefix}-${f.key}`, err(f.key as FieldKey))}
                            inputMode={f.kind === 'text' || f.kind === 'tl' ? 'text' : 'decimal'}
                            value={item.dims[f.key]}
                            onChange={(e) => setDim(f.key, e.target.value)}
                            placeholder={f.kind === 'tl' && item.product === 'sagrod' ? '100 → 100/100' : undefined}
                        />
                    </Field>
                ))}
                {item.product === 'plate' && item.plateType === 'ms_plate' && item.holeOption !== 'none' ? (
                    <>
                        <Field id={`${prefix}-holeDiameter`} label="Hole Ø" required error={err('holeDiameter')}>
                            <TextInput {...aria(`${prefix}-holeDiameter`, err('holeDiameter'))} inputMode="decimal" value={item.dims.holeDiameter} onChange={(e) => setDim('holeDiameter', e.target.value)} />
                        </Field>
                        {item.holeOption === 'custom' ? (
                            <Field id={`${prefix}-holesCount`} label="No. of holes" required error={err('holes')}>
                                <TextInput {...aria(`${prefix}-holesCount`, err('holes'))} inputMode="numeric" value={item.dims.holes} onChange={(e) => setDim('holes', e.target.value)} />
                            </Field>
                        ) : null}
                    </>
                ) : null}
                {spec.developedLength !== 'none' ? (
                    <Field
                        id={`${prefix}-developedLength`}
                        label="Developed length"
                        required={spec.developedLength === 'manual' || spec.developedLength === 'suggested'}
                        error={err('developedLength')}
                        hint={
                            spec.developedLength === 'formula'
                                ? g?.source === 'formula' && g.developedLength
                                    ? `Formula ${g.developedLength} — type to override`
                                    : 'From the formula'
                                : g?.suggestedDevelopedLength
                                  ? `Suggested ${g.suggestedDevelopedLength} (editable)`
                                  : spec.developedLength === 'manual'
                                    ? 'No formula — enter it'
                                    : 'No hard formula — enter it'
                        }
                    >
                        <div className="flex gap-2">
                            <TextInput
                                {...aria(`${prefix}-developedLength`, err('developedLength'))}
                                inputMode="decimal"
                                value={item.dims.developedLength}
                                onChange={(e) => setDim('developedLength', e.target.value)}
                                placeholder={spec.developedLength === 'formula' && g?.source === 'formula' && g.developedLength ? String(g.developedLength) : undefined}
                            />
                            {g?.suggestedDevelopedLength && !item.dims.developedLength.trim() ? (
                                <Button type="button" variant="secondary" size="sm" className="h-11 shrink-0 sm:h-10" onClick={() => setDim('developedLength', String(g.suggestedDevelopedLength))}>
                                    <Sparkles aria-hidden="true" /> Apply
                                </Button>
                            ) : null}
                        </div>
                    </Field>
                ) : null}
                {item.product === 'others' ? (
                    <Field id={`${prefix}-unitWeight`} label="Unit weight (kg)" error={err('unitWeight')} hint="Optional — needed for a calculated price">
                        <TextInput {...aria(`${prefix}-unitWeight`, err('unitWeight'))} inputMode="decimal" value={item.dims.unitWeight} onChange={(e) => setDim('unitWeight', e.target.value)} />
                    </Field>
                ) : null}
                {showQty ? (
                    <Field id={`${prefix}-qty`} label="Qty" required error={err('qty')}>
                        <TextInput {...aria(`${prefix}-qty`, err('qty'))} inputMode="numeric" value={item.qty} onChange={(e) => set({ qty: e.target.value })} />
                    </Field>
                ) : null}
            </div>
            {item.product === 'eyebolt' ? (
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={item.weld} onChange={(e) => set({ weld: e.target.checked })} />
                    Weld / FW
                </label>
            ) : null}
        </div>
    );
}

/* ── Accessories: "No accessories" + Add accessory (§18) ────────────────── */
export function AccessoriesFields({ prefix, value, onChange, err, compact = false }: { prefix: string; value: AccessoriesDraft; onChange: (a: AccessoriesDraft) => void; err: ErrFn; compact?: boolean }) {
    const none = !value.nut && !value.fw && !value.custom;
    const counted = (key: 'nut' | 'fw', label: string, def: number) => {
        const a = value[key];
        if (!a) return null;
        const set = (patch: Partial<typeof a>) => onChange({ ...value, [key]: { ...a, ...patch } });
        return (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[7rem_repeat(3,minmax(0,1fr))_auto]" data-testid={`${prefix}-acc-${key}`}>
                <span className="col-span-2 pb-2 text-sm font-medium sm:col-span-1">{label}</span>
                <Field id={`${prefix}-${key}-qty`} label="Qty per item" error={err(key)}>
                    <TextInput {...aria(`${prefix}-${key}-qty`, err(key))} inputMode="numeric" value={a.qty} placeholder={`${def} (default)`} onChange={(e) => set({ qty: e.target.value })} />
                </Field>
                <Field id={`${prefix}-${key}-finish`} label="Finish">
                    <Select id={`${prefix}-${key}-finish`} value={a.finish} onChange={(e) => set({ finish: e.target.value })}>
                        <option value="">—</option>
                        {FINISH_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field id={`${prefix}-${key}-price`} label="Unit price (RM)">
                    <TextInput id={`${prefix}-${key}-price`} inputMode="decimal" value={a.unitPrice} placeholder="0.00" onChange={(e) => set({ unitPrice: e.target.value })} />
                </Field>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label}`} className="mb-0.5" onClick={() => onChange({ ...value, [key]: null })}>
                    <Trash2 aria-hidden="true" />
                </Button>
            </div>
        );
    };
    return (
        <div className="flex flex-col gap-3" data-testid={`${prefix}-accessories`}>
            {none ? <p className="text-sm text-muted-foreground">No accessories</p> : null}
            {counted('nut', 'Nut', 2)}
            {counted('fw', 'Flat Washer', 1)}
            {value.custom ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_auto]" data-testid={`${prefix}-acc-custom`}>
                    <span className="col-span-2 pb-2 text-sm font-medium sm:col-span-1">Custom</span>
                    <Field id={`${prefix}-custom-text`} label="Description" error={err('custom')}>
                        <TextInput {...aria(`${prefix}-custom-text`, err('custom'))} value={value.custom.text} onChange={(e) => onChange({ ...value, custom: { ...value.custom!, text: e.target.value } })} />
                    </Field>
                    <Field id={`${prefix}-custom-price`} label="Unit price (RM)">
                        <TextInput id={`${prefix}-custom-price`} inputMode="decimal" value={value.custom.unitPrice} placeholder="0.00" onChange={(e) => onChange({ ...value, custom: { ...value.custom!, unitPrice: e.target.value } })} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" aria-label="Remove custom accessory" className="mb-0.5" onClick={() => onChange({ ...value, custom: null })}>
                        <Trash2 aria-hidden="true" />
                    </Button>
                </div>
            ) : null}
            <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
                {!value.nut ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...value, nut: { qty: '', finish: '', unitPrice: '' } })}>
                        <Plus aria-hidden="true" /> Nut
                    </Button>
                ) : null}
                {!value.fw ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...value, fw: { qty: '', finish: '', unitPrice: '' } })}>
                        <Plus aria-hidden="true" /> Flat washer
                    </Button>
                ) : null}
                {!value.custom ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onChange({ ...value, custom: { text: '', unitPrice: '' } })}>
                        <Plus aria-hidden="true" /> Custom
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

/* ── Pricing (§17): Calculated by default, Manual override as an explicit
   action, No Round only under Advanced. No "price mode" dropdown. ────────── */
export function PricingFields({ prefix, item, computed, onChange, err }: { prefix: string; item: DraftItem; computed: ComputedItem; onChange: Change; err: ErrFn }) {
    const p = item.pricing;
    const s = computed.suggested;
    const setP = (patch: Partial<DraftItem['pricing']>) => onChange({ ...item, pricing: { ...p, ...patch } });
    const rate = (key: 'costRate' | 'addCost' | 'markup', label: string, suggestion: string | null, unit: string) => {
        const typed = p[key] !== null;
        return (
            <Field
                id={`${prefix}-${key}`}
                label={label}
                error={err(key)}
                warning={computed.warnings[key]}
                hint={
                    typed ? (
                        suggestion !== null ? (
                            <button type="button" className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => setP({ [key]: null })}>
                                <RotateCcw className="size-3" aria-hidden="true" /> Use suggested {suggestion}
                            </button>
                        ) : (
                            'Typed'
                        )
                    ) : suggestion !== null ? (
                        `Suggested${s.source === 'tl_surcharge' && key === 'addCost' ? ' (TL)' : ''}`
                    ) : (
                        'No default'
                    )
                }
            >
                <div className="relative">
                    <TextInput
                        {...aria(`${prefix}-${key}`, err(key))}
                        inputMode="decimal"
                        value={p[key] ?? ''}
                        placeholder={suggestion ?? ''}
                        onChange={(e) => setP({ [key]: e.target.value === '' ? null : e.target.value })}
                        className="pr-10"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-subtle-foreground">{unit}</span>
                </div>
            </Field>
        );
    };
    const hdgHint = item.product === 'sagrod' && item.material === 'MS' && item.sizeType === 'FULLSIZE' && item.finish === 'HDG' && item.treatment === null;
    return (
        <div className="flex flex-col gap-3" data-testid={`${prefix}-pricing`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm" data-testid={`${prefix}-price-mode`}>
                    {p.mode === 'manual' ? (
                        <span className="font-semibold text-warning">Manual override</span>
                    ) : (
                        <span className="font-semibold text-foreground">Calculated{p.mode === 'no_round' ? ' · No round' : ''}</span>
                    )}
                </span>
                {p.mode === 'manual' ? (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setP({ mode: 'calculated' });
                            notify.info('Calculated price restored');
                        }}
                    >
                        <Undo2 aria-hidden="true" /> Use calculated price
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setP({ mode: 'manual', manualUnitPrice: p.manualUnitPrice || (computed.pricing && computed.pricing.finalUnitPrice > 0 ? computed.pricing.finalUnitPrice.toFixed(2) : '') });
                            notify.info('Manual price enabled — the calculated price stays as the reference');
                        }}
                        data-testid={`${prefix}-set-manual`}
                    >
                        Set manual price
                    </Button>
                )}
            </div>
            {p.mode === 'manual' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id={`${prefix}-manualUnitPrice`} label="Manual final unit price (RM)" required error={err('manualUnitPrice')}>
                        <TextInput {...aria(`${prefix}-manualUnitPrice`, err('manualUnitPrice'))} inputMode="decimal" value={p.manualUnitPrice} onChange={(e) => setP({ manualUnitPrice: e.target.value })} />
                    </Field>
                    <div className="flex flex-col justify-end gap-0.5 pb-1 text-sm text-muted-foreground">
                        <span>Calculated reference</span>
                        <span className="font-medium text-foreground tabular-nums" data-testid={`${prefix}-calculated-reference`}>
                            {computed.pricing && computed.pricing.roundedUnitPrice > 0 ? formatPrice(computed.pricing.roundedUnitPrice + computed.pricing.accessoriesCost) : '—'}
                        </span>
                    </div>
                </div>
            ) : null}
            <div className="grid grid-cols-3 gap-3">
                {rate('costRate', 'Cost rate', s.costRate !== null ? s.costRate.toFixed(2) : null, 'RM/kg')}
                {rate('addCost', 'Additional cost', s.addCost.toFixed(2), 'RM')}
                {rate('markup', 'Markup', String(s.markup), '%')}
            </div>
            {hdgHint ? <p className="text-xs text-subtle-foreground">{MS_FULLSIZE_HDG_RATE_HINT} — the suggested rate is one number (6.50).</p> : null}
            {p.mode !== 'manual' ? (
                <details className="text-sm">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced</summary>
                    <label className="mt-2 flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="size-4 accent-[var(--color-accent)]"
                            checked={p.mode === 'no_round'}
                            onChange={(e) => setP({ mode: e.target.checked ? 'no_round' : 'calculated' })}
                            data-testid={`${prefix}-no-round`}
                        />
                        No Round — use the unrounded calculated price
                    </label>
                </details>
            ) : null}
        </div>
    );
}

/* ── Live calculation preview (internal) ─────────────────────────────────── */
export function PricePreview({ computed, testId }: { computed: ComputedItem; testId?: string }) {
    const pr = computed.pricing;
    const markup = Number(computed.effective.markup) || 0;
    const rows: [string, string, string?][] = [
        ['Dimension', computed.dimensionLine ? formatDimensions(computed.dimensionLine) : '—'],
        ['Weight', computed.unitWeight > 0 ? `${computed.unitWeight.toFixed(3)} kg/pc${computed.lineWeight !== null ? ` · ${computed.lineWeight.toFixed(3)} kg` : ''}` : '—', 'weight'],
        ['Calculated unit', pr && pr.roundedUnitPrice > 0 ? formatPrice(pr.roundedUnitPrice) : '—', 'calculated'],
        ['Accessories / pc', pr && pr.accessoriesCost > 0 ? formatPrice(pr.accessoriesCost) : '—'],
        ['Final unit', pr && pr.finalUnitPrice > 0 ? formatPrice(pr.finalUnitPrice) : '—', 'final'],
        ['Markup', pr?.priceMode === 'manual' ? 'Manual' : markup ? `+${markup}%` : '—', 'markup'],
        ['Line total', pr && pr.totalAmount > 0 ? formatPrice(pr.totalAmount) : '—', 'total'],
    ];
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-[var(--radius-md)] border border-border bg-surface-muted/60 p-3 text-sm sm:grid-cols-4" data-testid={testId}>
            {rows.map(([k, v, id]) => (
                <div key={k} className={cn('min-w-0', k === 'Dimension' && 'col-span-2 sm:col-span-4')}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className={cn('truncate tabular-nums', k === 'Line total' || k === 'Final unit' ? 'font-semibold' : '')} data-testid={id && testId ? `${testId}-${id}` : undefined}>
                        {v}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
