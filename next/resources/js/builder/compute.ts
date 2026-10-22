import {
    buildDimension,
    canonicalSagRodTL,
    computeGeometry,
    effectiveDiameter,
    evalExpr,
    findDefaultPrice,
    interpretSize,
    isBlank,
    materialHasFinish,
    parseNum,
    priceItem,
    sizeTypeFor,
    tlSurcharge,
    tlSurchargeApplies,
    toLegacyMaterialCode,
    treatmentWording,
    type AccessoryInput,
    type GeometryResult,
    type PricingResult,
    type SizeInterpretation,
    type StructuredMaterial,
} from '@/domain';
import type { AccessoriesDraft, DraftItem } from './model';
import { PLATE_DIMS, productName, specFor, type DimField, type ProductSpec } from './products';

/* What the Builder shows for one item — computed by the domain engine from
   the item as typed. Nothing here re-implements a rule: diameter, developed
   length, weight, default price, TL surcharge, rounding and the final price
   all come from @/domain. This module only wires the inputs and says, field by
   field, what blocks the item (errors) or deserves a look (warnings). */

export const FINISH_OPTIONS = ['PL', 'ZP', 'HDG'] as const;

export type FieldKey =
    | 'product' | 'productName' | 'material' | 'propertyClass' | 'finish' | 'sizeType' | 'size' | 'diameter'
    | 'length' | 'l' | 'w' | 'h' | 'id' | 'ih' | 'oh' | 's' | 'threadLen' | 'developedLength'
    | 't' | 'triL' | 'triH' | 'triCL' | 'triCH' | 'triT' | 'holeDiameter' | 'holes' | 'dimensionText' | 'unitWeight'
    | 'qty' | 'nut' | 'fw' | 'custom' | 'costRate' | 'addCost' | 'markup' | 'manualUnitPrice' | 'price';

export interface SuggestedPricing {
    /** null ⇒ no built-in default for this identity (a rate must be typed). */
    costRate: number | null;
    addCost: number;
    markup: number;
    /** Where the suggestion came from, for the UI. */
    source: 'default' | 'tl_surcharge' | 'none';
}

export interface ComputedItem {
    item: DraftItem;
    spec: ProductSpec;
    /** Plain-text identity: `4140 QT FULLSIZE L BOLT · PL`, `S45C STUD · HARDENED TO G8.8 · PL`. */
    title: string;
    structuredMaterial: StructuredMaterial;
    /** Legacy stored code where one exists ('4140', 'S45C_HARDEN_G8_8'), else a structured label. */
    materialCode: string;
    size: SizeInterpretation | null;
    diameter: number | null;
    diameterSource: 'override' | 'built_in' | 'custom' | 'none';
    /** Sag Rod TL canonicalised (100 → 100/100); other products as typed. */
    threadLen: string;
    /** The engine's dimension line (legacy `x` spelling; the UI shows it canonically). */
    dimensionLine: string;
    geometry: GeometryResult | null;
    /** kg per piece. */
    unitWeight: number;
    /** kg for the line (unit weight × qty), null when there is no weight. */
    lineWeight: number | null;
    qty: number | null;
    suggested: SuggestedPricing;
    /** The figures actually priced (typed value, else the suggestion). */
    effective: { costRate: string; addCost: string; markup: string };
    pricing: PricingResult | null;
    errors: Partial<Record<FieldKey, string>>;
    warnings: Partial<Record<FieldKey, string>>;
    valid: boolean;
}

const NUMBER_RE = /^\d+(?:\.\d+)?$/;
const TL_RE = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?\s*(?:mm)?$/i;
const RATE_RE = /^[\d\s.+\-*/,]+$/;

export function structuredMaterialOf(item: DraftItem): StructuredMaterial {
    return {
        material: item.material,
        treatment: item.treatment,
        propertyClass: item.treatment ? item.propertyClass.trim() || null : null,
    };
}

/** Legacy code when the combination has one (so built-in defaults / surcharges match), else a readable label. */
export function materialCodeOf(item: DraftItem): string {
    const sm = structuredMaterialOf(item);
    return toLegacyMaterialCode(sm) ?? `${sm.material} + HARDEN = G${sm.propertyClass ?? ''}`;
}

export function finishOf(item: DraftItem): string {
    return materialHasFinish(item.material) ? item.finish : '';
}

export function toAccessoryInput(a: AccessoriesDraft): AccessoryInput {
    return {
        nut: a.nut ? { qty: a.nut.qty, finish: a.nut.finish, unitPrice: a.nut.unitPrice } : null,
        fw: a.fw ? { qty: a.fw.qty, finish: a.fw.finish, unitPrice: a.fw.unitPrice } : null,
        custom: a.custom ? { text: a.custom.text, unitPrice: a.custom.unitPrice } : null,
    };
}

/** The plain-text identity (no colour chips anywhere — W1 locked rule). */
export function itemTitle(item: DraftItem): string {
    const sm = structuredMaterialOf(item);
    const spec = specFor(item.product);
    const name =
        item.product === 'plate'
            ? item.plateType === 'triangle_plate'
                ? 'TRIANGLE PLATE'
                : 'PLATE'
            : productName(item.product, item.productName) || 'OTHERS';
    const sizeType = spec.hasSizeType ? item.sizeType : '';
    const head = [sm.material, sizeType, name].filter(Boolean).join(' ');
    return [head, treatmentWording(sm) ?? '', finishOf(item)].filter(Boolean).join(' · ');
}

export function suggestedPricing(item: DraftItem, normalisedSize: string, threadLen: string): SuggestedPricing {
    if (item.product === 'others') return { costRate: null, addCost: 0, markup: 0, source: 'none' };
    const code = materialCodeOf(item);
    const finish = finishOf(item);
    const def = findDefaultPrice(item.product, code, sizeTypeFor(item.product, item.sizeType), normalisedSize, finish);
    // Sag Rod: the thread-length Additional Cost replaces the default's 0 for the
    // materials and finishes the legacy form applies it to (never HDG).
    if (item.product === 'sagrod' && tlSurchargeApplies(code, finish)) {
        return { costRate: def ? def.costRate : null, addCost: tlSurcharge(threadLen), markup: def ? def.markup : 0, source: def ? 'tl_surcharge' : 'none' };
    }
    if (!def) return { costRate: null, addCost: 0, markup: 0, source: 'none' };
    return { costRate: def.costRate, addCost: def.addCost, markup: def.markup, source: 'default' };
}

function dimFieldsOf(item: DraftItem, spec: ProductSpec): DimField[] {
    return item.product === 'plate' ? PLATE_DIMS[item.plateType] : spec.dims;
}

export function computeItem(item: DraftItem): ComputedItem {
    const spec = specFor(item.product);
    const errors: Partial<Record<FieldKey, string>> = {};
    const warnings: Partial<Record<FieldKey, string>> = {};
    const d = item.dims;
    const sm = structuredMaterialOf(item);
    const materialCode = materialCodeOf(item);
    const finish = finishOf(item);
    const sizeType = spec.hasSizeType ? item.sizeType : '';

    // ── identity ──────────────────────────────────────────────────────────
    if (item.product === 'others' && !item.productName.trim()) errors.productName = 'Enter the product name';
    if (item.treatment === 'HARDEN' && !item.propertyClass.trim()) errors.propertyClass = 'Choose the property class';
    if (materialHasFinish(item.material) && !(FINISH_OPTIONS as readonly string[]).includes(item.finish)) errors.finish = 'Choose a finish';
    if (spec.hasSizeType && !item.sizeType) errors.sizeType = 'Choose Fullsize or Undersize';

    // ── size → diameter ───────────────────────────────────────────────────
    let size: SizeInterpretation | null = null;
    let diameter: number | null = null;
    let diameterSource: ComputedItem['diameterSource'] = 'none';
    const override = item.diameterOverride.trim();
    if (override) {
        if (!NUMBER_RE.test(override) || !(Number(override) > 0)) errors.diameter = 'Enter the bar diameter in mm';
        else {
            diameter = Number(override);
            diameterSource = 'override';
        }
    }
    if (spec.hasSize || (item.product === 'others' && item.size.trim())) {
        size = interpretSize(item.size);
        if (!size.normalised) {
            if (spec.hasSize) errors.size = 'Enter a size';
        } else if (diameterSource !== 'override') {
            const eff = effectiveDiameter(item.product, sm, sizeType, size.normalised);
            if (eff.diameter !== null && !size.needsReview) {
                diameter = eff.diameter;
                diameterSource = eff.source;
            } else if (size.needsReview) {
                errors.size =
                    size.reviewReason === 'bare_number_out_of_range'
                        ? `“${size.normalised}” looks like a length, not a size — check it, or enter the bar diameter`
                        : `${size.display} is not a size the tables know — enter the bar diameter`;
            } else {
                errors.diameter = `No built-in ${sizeType ? sizeType.toLowerCase() + ' ' : ''}diameter for ${size.display} — enter the bar diameter`;
            }
        } else if (size.needsReview) {
            warnings.size = `${size.display || size.normalised} needs review — priced from the typed diameter`;
        }
    }
    const normalisedSize = size?.normalised ?? '';

    // ── dimensions ────────────────────────────────────────────────────────
    for (const f of dimFieldsOf(item, spec)) {
        const v = String(d[f.key] ?? '').trim();
        if (!v) {
            if (f.required) errors[f.key] = `Enter ${f.label}`;
            continue;
        }
        if (f.kind === 'text') continue;
        if (f.kind === 'tl') {
            if (!TL_RE.test(v)) errors[f.key] = 'TL is a number, or two numbers like 100/100';
            continue;
        }
        if (!NUMBER_RE.test(v) || !(Number(v) > 0)) errors[f.key] = `${f.label} must be a number above 0`;
    }
    if (item.product === 'plate' && item.plateType === 'ms_plate' && item.holeOption !== 'none') {
        if (!NUMBER_RE.test(d.holeDiameter.trim())) errors.holeDiameter = 'Enter the hole diameter';
        if (item.holeOption === 'custom' && !/^\d+$/.test(d.holes.trim())) errors.holes = 'Enter the number of holes';
    }
    const threadLen = item.product === 'sagrod' ? canonicalSagRodTL(d.threadLen) : d.threadLen.trim();

    // ── developed length + weight ─────────────────────────────────────────
    const usesDeveloped = spec.developedLength !== 'none';
    const devTyped = d.developedLength.trim();
    if (usesDeveloped && devTyped && (!NUMBER_RE.test(devTyped) || !(Number(devTyped) > 0))) errors.developedLength = 'Developed length must be a number above 0';
    if (item.product === 'others' && d.unitWeight.trim() && !(NUMBER_RE.test(d.unitWeight.trim()) && Number(d.unitWeight) > 0)) {
        errors.unitWeight = 'Unit weight must be a number above 0';
    }
    let geometry: GeometryResult | null = null;
    try {
        geometry = computeGeometry({
            product: item.product,
            diameter: diameter ?? 0,
            length: d.length,
            l: d.l,
            w: d.w,
            h: d.h,
            id: d.id,
            ih: d.ih,
            oh: d.oh,
            s: d.s,
            plateType: item.plateType,
            t: d.t,
            triL: d.triL,
            triH: d.triH,
            triT: d.triT,
            developedLength: usesDeveloped && devTyped ? devTyped : undefined,
            unitWeight: item.product === 'others' ? d.unitWeight : undefined,
        });
    } catch {
        geometry = null;
    }
    if (usesDeveloped && !devTyped && geometry && geometry.source === 'none') {
        if (spec.developedLength === 'manual') errors.developedLength = 'Enter the developed length (no formula for this product)';
        else if (spec.developedLength === 'suggested') {
            errors.developedLength =
                geometry.suggestedDevelopedLength !== null
                    ? `Enter the developed length — suggested ${geometry.suggestedDevelopedLength}`
                    : 'Enter the developed length';
        }
    }
    const unitWeight = geometry ? geometry.weight : 0;

    // ── qty ───────────────────────────────────────────────────────────────
    const qtyText = item.qty.trim();
    let qty: number | null = null;
    if (!qtyText) errors.qty = 'Enter Qty';
    else if (!/^\d+$/.test(qtyText)) errors.qty = /^-/.test(qtyText) ? 'Qty cannot be negative' : 'Qty must be a whole number';
    else if (Number(qtyText) < 1) errors.qty = 'Qty must be at least 1';
    else qty = Number(qtyText);
    const lineWeight = unitWeight > 0 && qty !== null ? unitWeight * qty : null;

    // ── accessories ───────────────────────────────────────────────────────
    for (const key of ['nut', 'fw'] as const) {
        const a = item.accessories[key];
        if (!a) continue;
        if (a.qty.trim() && !NUMBER_RE.test(a.qty.trim())) errors[key] = 'Qty per item must be 0 or more';
        else if (a.unitPrice.trim() && !NUMBER_RE.test(a.unitPrice.trim())) errors[key] = 'Unit price must be a number';
    }
    if (item.accessories.custom) {
        const c = item.accessories.custom;
        if (!c.text.trim()) errors.custom = 'Describe the custom accessory';
        else if (c.unitPrice.trim() && !NUMBER_RE.test(c.unitPrice.trim())) errors.custom = 'Unit price must be a number';
    }

    // ── pricing ───────────────────────────────────────────────────────────
    const suggested = suggestedPricing(item, normalisedSize, threadLen);
    const p = item.pricing;
    const effective = {
        costRate: p.costRate ?? (suggested.costRate !== null ? suggested.costRate.toFixed(2) : ''),
        addCost: p.addCost ?? suggested.addCost.toFixed(2),
        markup: p.markup ?? String(suggested.markup),
    };
    for (const key of ['costRate', 'addCost', 'markup'] as const) {
        const v = effective[key].trim();
        if (v && !RATE_RE.test(v)) errors[key] = 'Enter a number';
    }
    if (p.mode === 'manual') {
        const m = p.manualUnitPrice.trim();
        if (!m) errors.manualUnitPrice = 'Enter the manual final unit price';
        else if (!RATE_RE.test(m) || !(evalExpr(m) > 0)) errors.manualUnitPrice = 'The manual price must be above 0';
    } else if (!effective.costRate.trim()) {
        errors.costRate = suggested.source === 'none' ? 'No default rate for this item — enter the cost rate' : 'Enter the cost rate';
    }
    if (p.markup !== null && p.markup.trim() && parseNum(p.markup) < 0) warnings.markup = 'Negative markup';

    let pricing: PricingResult | null = null;
    try {
        pricing = priceItem({
            product: item.product,
            weight: unitWeight,
            costRate: effective.costRate,
            addCost: effective.addCost,
            markup: effective.markup,
            mode: p.mode,
            manualUnitPrice: p.manualUnitPrice,
            accessories: toAccessoryInput(item.accessories),
            qty: qty ?? 0,
            priceList:
                item.product === 'sagrod'
                    ? { material: materialCode, sizeType: item.sizeType, finish, size: normalisedSize, threadLen, length: d.length }
                    : undefined,
        });
    } catch {
        pricing = null;
    }
    if (p.mode !== 'manual' && pricing && pricing.finalUnitPrice <= 0 && Object.keys(errors).length === 0) {
        errors.price =
            unitWeight <= 0
                ? item.product === 'others'
                    ? 'No weight to price from — enter a unit weight, or set a manual price'
                    : 'No weight to price from — check the size and dimensions'
                : 'The calculated price is RM 0.00 — check the rates';
    }

    // ── dimension line ────────────────────────────────────────────────────
    let dimensionLine = '';
    try {
        dimensionLine = buildDimension({
            product: item.product,
            size: normalisedSize,
            diameter: diameter ?? '',
            sizeType,
            length: d.length,
            l: d.l,
            w: d.w,
            h: d.h,
            id: d.id,
            ih: d.ih,
            oh: d.oh,
            s: d.s,
            threadLen,
            weld: item.weld,
            plateType: item.plateType,
            t: d.t,
            holeOption: item.holeOption,
            holeDiameter: d.holeDiameter,
            holes: d.holes,
            triL: d.triL,
            triH: d.triH,
            triCL: d.triCL,
            triCH: d.triCH,
            triT: d.triT,
            dimensionText: d.dimensionText,
        });
    } catch {
        dimensionLine = '';
    }

    return {
        item,
        spec,
        title: itemTitle(item),
        structuredMaterial: sm,
        materialCode,
        size,
        diameter,
        diameterSource,
        threadLen,
        dimensionLine,
        geometry,
        unitWeight,
        lineWeight,
        qty,
        suggested,
        effective,
        pricing,
        errors,
        warnings,
        valid: Object.keys(errors).length === 0,
    };
}

/** True when the field holds a value the person typed (not a suggestion). */
export function isTyped(v: string | null): v is string {
    return v !== null && !isBlank(v);
}
