import { DIA_FULLSIZE, DIA_UNDERSIZE, DIA_UNDERSIZE_INCH, PRODUCT_NAMES, sizeDisplay, type ProductType } from '@/domain';
import type { ItemDimensions } from './model';

/* Which inputs each product asks for, in the canonical DNC order (dimension
   line order of the engine's buildDimension). Presentation metadata only — the
   rules themselves (diameter, developed length, weight, price) are the
   engine's. */

export type DimKey = keyof ItemDimensions;

export interface DimField {
    key: DimKey;
    /** Canonical DNC label (L / W / H / ID / IH / OH / S / TL / T …). */
    label: string;
    /** Required to build the item (blank blocks it). */
    required: boolean;
    /** A free-text field (TL may be `a/b`; Others' dimension text). */
    kind?: 'number' | 'tl' | 'text';
    hint?: string;
}

export type DevelopedLengthKind =
    /** Straight products: none. */
    | 'none'
    /** Formula products: the engine computes it; a typed value overrides. */
    | 'formula'
    /** No formula: typed by the person (L Bolt 45°). */
    | 'manual'
    /** No hard formula; the engine offers an editable suggestion (J Hook L+W, Eye Bolt with S). */
    | 'suggested';

export interface ProductSpec {
    product: ProductType;
    label: string;
    /** Has a Size (rod / bolt diameter). */
    hasSize: boolean;
    /** Asks for FULLSIZE / UNDERSIZE. */
    hasSizeType: boolean;
    dims: DimField[];
    developedLength: DevelopedLengthKind;
    /** Offered in Batch Add (known high-frequency DNC products). */
    batchAdd: boolean;
}

const TL: DimField = { key: 'threadLen', label: 'TL', required: false, kind: 'tl', hint: 'Thread length' };

export const PRODUCT_SPECS: Record<Exclude<ProductType, 'was'>, ProductSpec> = {
    sagrod: {
        product: 'sagrod', label: 'Sag Rod', hasSize: true, hasSizeType: true, developedLength: 'none', batchAdd: true,
        dims: [{ key: 'length', label: 'L', required: true }, { ...TL, hint: 'Both ends: 100 means 100/100' }],
    },
    stud: {
        product: 'stud', label: 'Stud', hasSize: true, hasSizeType: false, developedLength: 'none', batchAdd: true,
        dims: [{ key: 'l', label: 'L', required: true }],
    },
    anchorbolt: {
        product: 'anchorbolt', label: 'Anchor Bolt', hasSize: true, hasSizeType: true, developedLength: 'none', batchAdd: true,
        dims: [{ key: 'l', label: 'L', required: true }, TL],
    },
    ubolt: {
        product: 'ubolt', label: 'U-Bolt', hasSize: true, hasSizeType: true, developedLength: 'formula', batchAdd: true,
        dims: [{ key: 'id', label: 'ID', required: true }, { key: 'ih', label: 'IH', required: true }, TL],
    },
    squbolt: {
        product: 'squbolt', label: 'SQ U-Bolt', hasSize: true, hasSizeType: true, developedLength: 'formula', batchAdd: true,
        dims: [{ key: 'oh', label: 'OH', required: true }, { key: 'w', label: 'W', required: true }, TL],
    },
    lbolt: {
        product: 'lbolt', label: 'L Bolt', hasSize: true, hasSizeType: true, developedLength: 'formula', batchAdd: true,
        dims: [{ key: 'l', label: 'L', required: true }, { key: 'w', label: 'W', required: true }, TL],
    },
    lbolt45: {
        product: 'lbolt45', label: 'L Bolt 45°', hasSize: true, hasSizeType: true, developedLength: 'manual', batchAdd: false,
        dims: [{ key: 'l', label: 'L', required: true }, { key: 'w', label: 'W', required: true }, TL],
    },
    jbolt: {
        product: 'jbolt', label: 'J Bolt', hasSize: true, hasSizeType: true, developedLength: 'formula', batchAdd: true,
        dims: [{ key: 'h', label: 'H', required: true }, { key: 'id', label: 'ID', required: true }, { key: 's', label: 'S', required: true }, TL],
    },
    jhook: {
        product: 'jhook', label: 'J Hook', hasSize: true, hasSizeType: true, developedLength: 'suggested', batchAdd: false,
        dims: [{ key: 'l', label: 'L', required: true }, { key: 'w', label: 'W', required: true }, TL],
    },
    eyebolt: {
        product: 'eyebolt', label: 'Eye Bolt', hasSize: true, hasSizeType: true, developedLength: 'suggested', batchAdd: false,
        dims: [
            { key: 'l', label: 'L', required: true },
            { key: 'id', label: 'ID', required: true },
            { key: 's', label: 'S', required: false, hint: 'Optional — with S the J Bolt geometry is suggested' },
            TL,
        ],
    },
    plate: {
        product: 'plate', label: 'Plate', hasSize: false, hasSizeType: false, developedLength: 'none', batchAdd: false,
        dims: [],
    },
    others: {
        product: 'others', label: 'Others / Special', hasSize: false, hasSizeType: false, developedLength: 'none', batchAdd: false,
        dims: [{ key: 'dimensionText', label: 'Dimension', required: true, kind: 'text', hint: 'As it should read on the quotation' }],
    },
};

/** Products the Builder can create in Session E (WAS needs its own form — deferred). */
export const BUILDER_PRODUCTS = Object.keys(PRODUCT_SPECS) as Exclude<ProductType, 'was'>[];
export const BATCH_ADD_PRODUCTS = BUILDER_PRODUCTS.filter((p) => PRODUCT_SPECS[p].batchAdd);

export type BuilderProduct = (typeof BUILDER_PRODUCTS)[number];

export function specFor(product: ProductType): ProductSpec {
    if (product === 'was') throw new Error('Welding Anchor Set entry is not part of the Session E builder');
    return PRODUCT_SPECS[product];
}

export function productLabel(product: ProductType): string {
    return product === 'was' ? 'Welding Anchor Set' : PRODUCT_SPECS[product].label;
}

export function productName(product: ProductType, typed = ''): string {
    return product === 'others' ? typed.trim() : PRODUCT_NAMES[product];
}

/* Plate dimensions by plate type (legacy buildPlateSizeStr order). */
export const PLATE_DIMS: Record<'ms_plate' | 'triangle_plate', DimField[]> = {
    ms_plate: [
        { key: 'l', label: 'L', required: true },
        { key: 'w', label: 'W', required: true },
        { key: 't', label: 'T', required: true },
    ],
    triangle_plate: [
        { key: 'triL', label: 'L', required: true },
        { key: 'triH', label: 'H', required: true },
        { key: 'triCL', label: 'CL', required: false, hint: 'Cut length (optional)' },
        { key: 'triCH', label: 'CH', required: false, hint: 'Cut height (optional)' },
        { key: 'triT', label: 'T', required: true },
    ],
};

/* Size suggestions for the searchable size field: every size the built-in
   tables know (metric first, then inch), customer spelling. Free text stays
   allowed — an unusual size is never blocked, it is interpreted (§12). */
function sizeSortKey(s: string): number {
    const m = /^M(\d+(?:\.\d+)?)$/.exec(s);
    if (m) return Number(m[1]);
    const whole = /^(\d+)"$/.exec(s);
    if (whole) return 1000 + Number(whole[1]) * 25.4;
    const frac = /^(?:(\d+)-)?(\d+)\/(\d+)$/.exec(s);
    if (frac) return 1000 + ((Number(frac[1] ?? 0) + Number(frac[2]) / Number(frac[3])) * 25.4);
    return 9999;
}

export const SIZE_OPTIONS: { value: string; label: string }[] = Array.from(
    new Set([...Object.keys(DIA_FULLSIZE), ...Object.keys(DIA_UNDERSIZE), ...Object.keys(DIA_UNDERSIZE_INCH)]),
)
    .sort((a, b) => sizeSortKey(a) - sizeSortKey(b))
    .map((s) => ({ value: s, label: sizeDisplay(s) }));
