import { Plus, RotateCcw, Sparkles, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
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

/**
 * An input that shows an AUTO value (suggestion / calculation) until the person
 * types: a typed value is CUSTOM and is never overwritten; emptying the field
 * and leaving it returns to AUTO. While focused the person's text is kept as
 * typed (clearing to retype never snaps back to the suggestion mid-edit).
 */
export function AutoValueInput({
    id,
    autoValue,
    customValue,
    onCustom,
    error,
    inputMode = 'decimal',
    testId,
}: {
    id: string;
    autoValue: string;
    customValue: string;
    onCustom: (text: string) => void;
    error?: string;
    inputMode?: 'decimal' | 'numeric' | 'text';
    testId?: string;
}) {
    const [editing, setEditing] = useState<string | null>(null);
    const shown = editing !== null ? editing : customValue.trim() !== '' ? customValue : autoValue;
    return (
        <TextInput
            {...aria(id, error)}
            inputMode={inputMode}
            value={shown}
            data-testid={testId}
            data-state={customValue.trim() !== '' ? 'custom' : 'auto'}
            onFocus={() => setEditing(shown)}
            onChange={(e) => {
                setEditing(e.target.value);
                onCustom(e.target.value);
            }}
            onBlur={() => setEditing(null)}
        />
    );
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
    const hasBar = spec.hasSize || (item.product === 'others' && item.size.trim() !== '');
    const customBar = item.diameterOverride.trim() !== '';
    const sizeTypeLabel = spec.hasSizeType && item.sizeType ? (item.sizeType === 'UNDERSIZE' ? 'Undersize' : 'Fullsize') : '';
    const fmtDia = (v: number) => String(Math.round(v * 1000) / 1000);
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
                        hint={computed.size?.label || 'M12, 12, 1/2 …'}
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
                {hasBar ? (
                    <Field
                        id={`${prefix}-diameter`}
                        label="Bar Ø (mm)"
                        error={err('diameter')}
                        hint={
                            customBar ? (
                                <span className="inline-flex flex-wrap items-center gap-x-1.5" data-testid={`${prefix}-diameter-state`}>
                                    <span className="font-medium text-foreground">Custom</span>
                                    {computed.suggestedDiameter !== null && Number(item.diameterOverride) !== computed.suggestedDiameter ? (
                                        <button type="button" className="text-accent hover:underline" onClick={() => set({ diameterOverride: '' })} data-testid={`${prefix}-diameter-use-suggested`}>
                                            Use suggested Ø{fmtDia(computed.suggestedDiameter)}
                                        </button>
                                    ) : null}
                                </span>
                            ) : computed.suggestedDiameter !== null ? (
                                <span data-testid={`${prefix}-diameter-state`}>Suggested from {[computed.size?.display, sizeTypeLabel].filter(Boolean).join(' · ')}</span>
                            ) : (
                                <span data-testid={`${prefix}-diameter-state`}>Enter the bar diameter</span>
                            )
                        }
                    >
                        <AutoValueInput
                            id={`${prefix}-diameter`}
                            autoValue={computed.suggestedDiameter !== null ? fmtDia(computed.suggestedDiameter) : ''}
                            customValue={item.diameterOverride}
                            onCustom={(t) => set({ diameterOverride: t })}
                            error={err('diameter')}
                            testId={`${prefix}-diameter-input`}
                        />
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
                {spec.developedLength === 'formula' ? (
                    <Field
                        id={`${prefix}-developedLength`}
                        label="Developed length"
                        error={err('developedLength')}
                        hint={
                            computed.developedLengthSource === 'custom' ? (
                                <span className="inline-flex flex-wrap items-center gap-x-1.5" data-testid={`${prefix}-developedLength-state`}>
                                    <span className="font-medium text-foreground">Custom</span>
                                    {computed.calculatedDevelopedLength !== null ? (
                                        <>
                                            <span>· Calculated: {computed.calculatedDevelopedLength} mm</span>
                                            <button type="button" className="text-accent hover:underline" onClick={() => setDim('developedLength', '')} data-testid={`${prefix}-developedLength-use-calculated`}>
                                                Use calculated
                                            </button>
                                        </>
                                    ) : null}
                                </span>
                            ) : (
                                <span data-testid={`${prefix}-developedLength-state`}>{computed.calculatedDevelopedLength !== null ? 'Calculated — edit to override' : 'Calculated once the dimensions are in'}</span>
                            )
                        }
                    >
                        <AutoValueInput
                            id={`${prefix}-developedLength`}
                            autoValue={computed.calculatedDevelopedLength !== null ? String(computed.calculatedDevelopedLength) : ''}
                            customValue={item.dims.developedLength}
                            onCustom={(t) => setDim('developedLength', t)}
                            error={err('developedLength')}
                            testId={`${prefix}-developedLength-input`}
                        />
                    </Field>
                ) : spec.developedLength !== 'none' ? (
                    <Field
                        id={`${prefix}-developedLength`}
                        label="Developed length"
                        required
                        error={err('developedLength')}
                        hint={
                            g?.suggestedDevelopedLength
                                ? `Suggested ${g.suggestedDevelopedLength} (editable — Apply or type)`
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

/* ── Pricing (§17 + Owner Smoke #2):
     Calculated Unit  — always computed and always shown (Bar Ø, developed
                        length, weight, rates, rounding)
     Override Unit    — an explicit human override ("Override unit price")
     Final Unit       — the price used: the override, else the calculated one
   No price-mode dropdown; No Round only under Advanced. Historical / customer
   price suggestions are Session F. ───────────────────────────────────────── */
export function PricingFields({ prefix, item, computed, onChange, err }: { prefix: string; item: DraftItem; computed: ComputedItem; onChange: Change; err: ErrFn }) {
    const p = item.pricing;
    const s = computed.suggested;
    const setP = (patch: Partial<DraftItem['pricing']>) => onChange({ ...item, pricing: { ...p, ...patch } });
    const overriding = p.override !== null;
    const calc = computed.calculated;
    const calcUnit = calc && calc.finalUnitPrice > 0 ? formatPrice(calc.finalUnitPrice) : '—';
    const finalUnit = computed.pricing && computed.pricing.finalUnitPrice > 0 ? formatPrice(computed.pricing.finalUnitPrice) : '—';
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
            <div className="grid grid-cols-3 gap-3">
                {rate('costRate', 'Cost rate', s.costRate !== null ? s.costRate.toFixed(2) : null, 'RM/kg')}
                {rate('addCost', 'Additional cost', s.addCost.toFixed(2), 'RM')}
                {rate('markup', 'Markup', String(s.markup), '%')}
            </div>
            {hdgHint ? <p className="text-xs text-subtle-foreground">{MS_FULLSIZE_HDG_RATE_HINT} — the suggested rate is one number (6.50).</p> : null}

            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-[var(--radius-md)] border border-border p-3 sm:grid-cols-3" data-testid={`${prefix}-price-ladder`}>
                <div>
                    <dt className="text-xs text-muted-foreground">Calculated unit{p.noRound ? ' · No round' : ''}</dt>
                    <dd className="font-medium tabular-nums" data-testid={`${prefix}-calculated-unit`}>
                        {calcUnit}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">Override unit</dt>
                    <dd className="tabular-nums">
                        {overriding ? (
                            <div className="flex flex-col gap-1">
                                <div className="relative">
                                    <TextInput
                                        {...aria(`${prefix}-override`, err('override'))}
                                        inputMode="decimal"
                                        value={p.override ?? ''}
                                        onChange={(e) => setP({ override: e.target.value })}
                                        className="pl-9"
                                        data-testid={`${prefix}-override-input`}
                                    />
                                    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-subtle-foreground">RM</span>
                                </div>
                                {err('override') ? (
                                    <p id={`${prefix}-override-error`} role="alert" className="text-xs text-danger" data-testid={`error-${prefix}-override`}>
                                        {err('override')}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <span className="text-muted-foreground" data-testid={`${prefix}-override-none`}>
                                —
                            </span>
                        )}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">Final unit</dt>
                    <dd className={cn('font-semibold tabular-nums', overriding && 'text-warning')} data-testid={`${prefix}-final-unit`}>
                        {finalUnit}
                    </dd>
                </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm" data-testid={`${prefix}-price-mode`}>
                    {overriding ? <span className="font-semibold text-warning">Override</span> : <span className="font-semibold text-foreground">Calculated</span>}
                </span>
                {overriding ? (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setP({ override: null });
                            notify.info('Calculated price restored');
                        }}
                        data-testid={`${prefix}-use-calculated`}
                    >
                        <Undo2 aria-hidden="true" /> Use calculated price
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setP({ override: calc && calc.finalUnitPrice > 0 ? calc.finalUnitPrice.toFixed(2) : '' });
                            notify.info('Unit price overridden — the calculated price stays visible');
                        }}
                        data-testid={`${prefix}-override-unit`}
                    >
                        Override unit price
                    </Button>
                )}
            </div>
            <details className="text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced</summary>
                <label className="mt-2 flex items-center gap-2">
                    <input
                        type="checkbox"
                        className="size-4 accent-[var(--color-accent)]"
                        checked={p.noRound}
                        onChange={(e) => setP({ noRound: e.target.checked })}
                        data-testid={`${prefix}-no-round`}
                    />
                    No Round — the calculated price is not DNC-rounded
                </label>
            </details>
        </div>
    );
}

/* ── Live calculation preview (internal) ─────────────────────────────────── */
export function PricePreview({ computed, testId }: { computed: ComputedItem; testId?: string }) {
    const pr = computed.pricing;
    const calc = computed.calculated;
    const markup = Number(computed.effective.markup) || 0;
    const rows: [string, string, string?][] = [
        ['Dimension', computed.dimensionLine ? formatDimensions(computed.dimensionLine) : '—'],
        ['Bar Ø', computed.diameter !== null ? `${computed.diameter} mm${computed.diameterSource === 'custom' ? ' · custom' : ''}` : '—', 'bar'],
        ['Weight', computed.unitWeight > 0 ? `${computed.unitWeight.toFixed(3)} kg/pc${computed.lineWeight !== null ? ` · ${computed.lineWeight.toFixed(3)} kg` : ''}` : '—', 'weight'],
        ['Calculated unit', calc && calc.finalUnitPrice > 0 ? formatPrice(calc.finalUnitPrice) : '—', 'calculated'],
        ['Accessories / pc', calc && calc.accessoriesCost > 0 ? formatPrice(calc.accessoriesCost) : '—'],
        ['Override unit', computed.overrideUnitPrice !== null ? formatPrice(computed.overrideUnitPrice) : '—', 'override'],
        ['Final unit', pr && pr.finalUnitPrice > 0 ? formatPrice(pr.finalUnitPrice) : '—', 'final'],
        ['Markup', markup ? `+${markup}%` : '—', 'markup'],
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
