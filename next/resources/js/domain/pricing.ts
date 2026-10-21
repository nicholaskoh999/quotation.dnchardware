import { type AccessoryInput, type ItemAccessories, accessoryUnitTotal, buildAccessories } from './accessories';
import { parseMaterial } from './material';
import { type NumericInput, evalExpr, parseNum } from './numbers';
import type { ProductType } from './products';
import { type RoundingRule, round05, roundMoney2, roundingRuleFor, applyRounding } from './rounding';
import { normalizeSizeValue } from './size';
import { type WasWeightInput, type WasWeights, wasWeights } from './weight';

/* Pricing (handoff §17, R0b §2).

     base  = weight × Cost Rate + Additional Cost
     raw   = base × (1 + Markup / 100)
     DNC rounded = product rule (rounding.ts)
     Final Unit Price = rounded bolt + Σ accessories      (accessory-inclusive)

   Modes (§17): CALCULATED (legacy "Auto Round") is the normal flow; NO ROUND
   (money2(raw)) survives under Advanced; MANUAL is an explicit override whose
   figure is the CUSTOMER's price — accessories come out of it to leave the bolt.
   The MS UNDERSIZE M12 PL TL 100/100 price list (L1000 RM4.00, L1200 RM4.20)
   overrides the formula in both CALCULATED and NO ROUND; MANUAL still wins.
   WAS is the one product whose accessories are inside the markup.

   Every result records `priceSource` so history identity can tell which of the
   capabilities produced the price (§34 C-3). */

export type PriceMode = 'calculated' | 'no_round' | 'manual';
export type PriceSource = 'calculated' | 'no_round' | 'manual' | 'price_list';
export type LegacyPriceMode = 'auto' | 'no_round' | 'manual';

export const PRICING_MODEL = 'accessory-inclusive';
export const PRICING_MODEL_SEPARATE = 'bolt-separate';

/** Read a stored / typed price mode. Legacy 'auto' is CALCULATED; anything unknown is CALCULATED (legacy getPriceMode). */
export function normalizePriceMode(raw: unknown): PriceMode {
    const v = String(raw ?? '');
    if (v === 'manual' || v === 'no_round') return v;
    return 'calculated';
}

/** The legacy stored spelling of a mode (for the compatible write path). */
export function legacyPriceMode(mode: PriceMode): LegacyPriceMode {
    return mode === 'calculated' ? 'auto' : mode;
}

/* ── MS UNDERSIZE M12 PL TL 100/100 price list (legacy getMSUndersizeSagRodPLSpecialPrice) ── */
export interface PriceListContext {
    material: unknown;
    sizeType: string | null | undefined;
    finish: string | null | undefined;
    size: unknown;
    threadLen: unknown;
    length: NumericInput;
}

export const MS_UNDERSIZE_M12_PL_PRICE_LIST: Readonly<Record<number, number>> = { 1000: 4.0, 1200: 4.2 };

function normalizeThreadLengthKey(raw: unknown): string {
    return String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/MM/g, '');
}

export function msUndersizeSagRodPriceList(ctx: PriceListContext): number | null {
    const sm = parseMaterial(ctx.material);
    const isMatch =
        !!sm && sm.material === 'MS' && sm.treatment === null &&
        ctx.sizeType === 'UNDERSIZE' &&
        ctx.finish === 'PL' &&
        normalizeSizeValue(ctx.size) === 'M12' &&
        normalizeThreadLengthKey(ctx.threadLen) === '100/100';
    if (!isMatch) return null;
    const l = Math.round(parseNum(ctx.length));
    return MS_UNDERSIZE_M12_PL_PRICE_LIST[l] ?? null;
}

/* ── Line money (legacy dcLineMoney) ── */
export interface LineMoney {
    boltUnitPrice: number;
    accessoryUnitPrice: number;
    finalUnitPrice: number;
    lineUnitPrice: number;
    accessoryTotal: number;
    totalAmount: number;
    pricingModel: typeof PRICING_MODEL;
}

/** Settle a line from the CUSTOMER-FACING unit price: the bolt is separated back out for the record. */
export function lineMoney(finalUnitPrice: NumericInput, accessories: Partial<ItemAccessories> | null | undefined, qty: NumericInput): LineMoney {
    const accUnit = roundMoney2(accessoryUnitTotal(accessories));
    const final = roundMoney2(Number(finalUnitPrice) || 0);
    const bolt = roundMoney2(final - accUnit);
    const n = Number.parseInt(String(qty ?? ''), 10) || 0;
    return {
        boltUnitPrice: bolt,
        accessoryUnitPrice: accUnit,
        finalUnitPrice: final,
        lineUnitPrice: final,
        accessoryTotal: roundMoney2(accUnit * n),
        totalAmount: roundMoney2(final * n),
        pricingModel: PRICING_MODEL,
    };
}

function isSavedShape(a: unknown): a is ItemAccessories {
    if (!a || typeof a !== 'object') return false;
    const o = a as Record<string, unknown>;
    return ['nut', 'fw', 'custom'].some((k) => !!o[k] && typeof o[k] === 'object' && 'enabled' in (o[k] as object));
}

/** Accept either the saved accessory shape or a form selection. */
export function toItemAccessories(a: ItemAccessories | AccessoryInput | null | undefined): ItemAccessories {
    return isSavedShape(a) ? a : buildAccessories(a as AccessoryInput | null | undefined);
}

/* ── Product pricing ── */
export interface PricingInput {
    product: ProductType;
    /** Unit weight (kg). */
    weight: number;
    costRate: NumericInput;
    addCost: NumericInput;
    markup: NumericInput;
    /** 'calculated' (or legacy 'auto'), 'no_round', 'manual'. */
    mode?: PriceMode | LegacyPriceMode | string | null;
    /** The customer's unit price, read only in MANUAL mode. */
    manualUnitPrice?: NumericInput;
    accessories?: ItemAccessories | AccessoryInput | null;
    qty?: NumericInput;
    /** Sag Rod identity for the price-list check. */
    priceList?: PriceListContext;
}

export interface PricingResult extends LineMoney {
    weight: number;
    basePrice: number;
    rawUnitPrice: number;
    /** The DNC-rounded reference (or the price-list figure). */
    roundedUnitPrice: number;
    roundingRule: RoundingRule;
    /** Σ accessories per item, two decimals. */
    accessoriesCost: number;
    priceMode: PriceMode;
    legacyPriceMode: LegacyPriceMode;
    priceSource: PriceSource;
    priceListApplied: boolean;
    accessories: ItemAccessories;
}

export function priceItem(input: PricingInput): PricingResult {
    if (input.product === 'was') throw new Error('priceItem: a Welding Anchor Set is priced with priceWAS()');
    const mode = normalizePriceMode(input.mode);
    const weight = Number(input.weight) || 0;
    const costRate = evalExpr(input.costRate);
    const addCost = evalExpr(input.addCost);
    const markup = parseNum(input.markup);
    const accessories = toItemAccessories(input.accessories);
    const rule = roundingRuleFor(input.product);

    const basePrice = weight * costRate + addCost;
    const special = input.product === 'sagrod' && input.priceList ? msUndersizeSagRodPriceList(input.priceList) : null;
    const rawUnitPrice = special !== null ? special : basePrice * (1 + markup / 100);
    const roundedUnitPrice = special !== null ? special : applyRounding(rule, rawUnitPrice);

    // legacy resolvePriceMode
    const accUnit = roundMoney2(accessoryUnitTotal(accessories));
    let finalUnitPrice: number;
    if (mode === 'manual') {
        finalUnitPrice = roundMoney2(evalExpr(input.manualUnitPrice));
    } else {
        const boltUnitPrice = roundMoney2(mode === 'no_round' ? rawUnitPrice : roundedUnitPrice);
        finalUnitPrice = roundMoney2(boltUnitPrice + accUnit);
    }
    const money = lineMoney(finalUnitPrice, accessories, input.qty ?? 1);
    const priceSource: PriceSource = mode === 'manual' ? 'manual' : special !== null ? 'price_list' : mode;
    return {
        weight,
        basePrice,
        rawUnitPrice,
        roundedUnitPrice,
        roundingRule: rule,
        accessoriesCost: accUnit,
        // the saved line (legacy pushItem → dcLineMoney); the bolt is re-separated from the final price
        ...money,
        priceMode: mode,
        legacyPriceMode: legacyPriceMode(mode),
        priceSource,
        priceListApplied: special !== null && mode !== 'manual',
        accessories,
    };
}

/* ── Welding Anchor Set (legacy getWASCalc) ──────────────────────────────── */
export interface WasPricingInput extends WasWeightInput {
    anchorCostRate: NumericInput;
    basePlateCostRate: NumericInput;
    trianglePlateCostRate?: NumericInput;
    addCost: NumericInput;
    markup: NumericInput;
    mode?: PriceMode | LegacyPriceMode | string | null;
    manualUnitPrice?: NumericInput;
    accessories?: ItemAccessories | AccessoryInput | null;
    qty?: NumericInput;
}

export interface WasPricingResult {
    weights: WasWeights;
    setWeight: number;
    anchorWeight: number;
    basePlateWeight: number;
    trianglePlateWeight: number;
    anchorCost: number;
    basePlateCost: number;
    trianglePlateCost: number;
    basePrice: number;
    addCost: number;
    /** Σ accessories per set — INSIDE the markup (the WAS exception). */
    accessories: number;
    markup: number;
    rawUnitPrice: number;
    roundedUnitPrice: number;
    finalUnitPrice: number;
    lineUnitPrice: number;
    totalAmount: number;
    priceMode: PriceMode;
    legacyPriceMode: LegacyPriceMode;
    priceSource: Exclude<PriceSource, 'price_list'>;
    roundingRule: 'round05';
}

export function priceWAS(input: WasPricingInput): WasPricingResult {
    const mode = normalizePriceMode(input.mode);
    const weights = wasWeights(input);
    const anchorRate = evalExpr(input.anchorCostRate);
    const basePlateRate = evalExpr(input.basePlateCostRate);
    const trianglePlateRate = evalExpr(input.trianglePlateCostRate);
    const anchorCost = weights.anchorWeight * anchorRate;
    const basePlateCost = weights.basePlateWeight * basePlateRate;
    const trianglePlateCost = weights.trianglePlateQty > 0 ? weights.trianglePlateWeight * trianglePlateRate : 0;
    const basePrice = anchorCost + basePlateCost + trianglePlateCost;
    const addCost = evalExpr(input.addCost);
    const accessories = accessoryUnitTotal(toItemAccessories(input.accessories));
    const markup = parseNum(input.markup);
    const rawUnitPrice = (basePrice + addCost + accessories) * (1 + markup / 100);
    const roundedUnitPrice = round05(rawUnitPrice);
    // resolvePriceMode(…, accessoriesCost = 0): the accessories are already inside.
    const finalUnitPrice =
        mode === 'manual' ? roundMoney2(evalExpr(input.manualUnitPrice)) : roundMoney2(mode === 'no_round' ? rawUnitPrice : roundedUnitPrice);
    const qty = Number.parseInt(String(input.qty ?? 1), 10) || 0;
    return {
        weights,
        setWeight: weights.setWeight,
        anchorWeight: weights.anchorWeight,
        basePlateWeight: weights.basePlateWeight,
        trianglePlateWeight: weights.trianglePlateWeight,
        anchorCost,
        basePlateCost,
        trianglePlateCost,
        basePrice,
        addCost,
        accessories,
        markup,
        rawUnitPrice,
        roundedUnitPrice,
        finalUnitPrice,
        lineUnitPrice: finalUnitPrice,
        // legacy addWAS stores finalUnitPrice × qty unrounded
        totalAmount: finalUnitPrice * qty,
        priceMode: mode,
        legacyPriceMode: legacyPriceMode(mode),
        priceSource: mode,
        roundingRule: 'round05',
    };
}

/* ── Reading saved items as they were written (three pricing vintages) ─────
     accessory-inclusive   finalUnitPrice IS the customer's price; bolt beside it
     bolt-separate         finalUnitPrice was the BOLT, lineUnitPrice the customer's line
     legacy (no model)     one figure with any charge already inside it          */
export interface SavedPricing {
    pricingModel?: string | null;
    finalUnitPrice?: unknown;
    boltUnitPrice?: unknown;
    accessoryUnitPrice?: unknown;
    lineUnitPrice?: unknown;
    totalAmount?: unknown;
    qty?: unknown;
    priceMode?: unknown;
    manualUnitPrice?: unknown;
    formData?: Record<string, unknown> | null;
}

export function itemIsInclusive(item: SavedPricing | null | undefined): boolean {
    return !!item && item.pricingModel === PRICING_MODEL;
}
export function itemIsSeparated(item: SavedPricing | null | undefined): boolean {
    return !!item && item.pricingModel === PRICING_MODEL_SEPARATE;
}

/** Legacy `dcItemAccUnit`. */
export function itemAccessoryUnit(item: SavedPricing | null | undefined): number {
    return item && (itemIsInclusive(item) || itemIsSeparated(item)) ? Number(item.accessoryUnitPrice) || 0 : 0;
}

/** Legacy `dcItemFinalUnit`: what the customer pays for one piece, whatever the vintage. */
export function itemFinalUnit(item: SavedPricing | null | undefined): number {
    if (!item) return 0;
    if (itemIsSeparated(item)) {
        const line = Number(item.lineUnitPrice);
        return Number.isFinite(line) && line > 0
            ? roundMoney2(line)
            : roundMoney2((Number(item.finalUnitPrice) || 0) + (Number(item.accessoryUnitPrice) || 0));
    }
    return roundMoney2(Number(item.finalUnitPrice) || 0);
}

/** Legacy `dcItemBoltUnit`: the internal bolt component (never shown as the customer's price). */
export function itemBoltUnit(item: SavedPricing | null | undefined): number {
    if (!item) return 0;
    if (itemIsSeparated(item)) return roundMoney2(Number(item.finalUnitPrice) || 0);
    if (itemIsInclusive(item)) {
        const bolt = Number(item.boltUnitPrice);
        return Number.isFinite(bolt)
            ? roundMoney2(bolt)
            : roundMoney2((Number(item.finalUnitPrice) || 0) - (Number(item.accessoryUnitPrice) || 0));
    }
    return roundMoney2(Number(item.finalUnitPrice) || 0);
}

export interface MigratedPricing<T> {
    item: T;
    /** A bolt-separate MANUAL price that had to be folded up to the customer's price. */
    foldedManual: boolean;
}

/** Legacy `dcMigrateItemPricing`: a bolt-separate item read into the accessory-inclusive model. Money is not moved. */
export function migrateItemPricing<T extends SavedPricing>(item: T): MigratedPricing<T> {
    if (!item || !itemIsSeparated(item)) return { item, foldedManual: false };
    const acc = roundMoney2(Number(item.accessoryUnitPrice) || 0);
    const bolt = roundMoney2(Number(item.finalUnitPrice) || 0);
    const line = itemFinalUnit(item);
    const qty = Number.parseInt(String(item.qty ?? ''), 10) || 0;
    const total = Number(item.totalAmount);
    const out: T = {
        ...item,
        boltUnitPrice: bolt,
        accessoryUnitPrice: acc,
        finalUnitPrice: line,
        lineUnitPrice: line,
        accessoryTotal: roundMoney2(acc * qty),
        totalAmount: Number.isFinite(total) && total > 0 ? roundMoney2(total) : roundMoney2(line * qty),
        pricingModel: PRICING_MODEL,
    };
    let foldedManual = false;
    const mode = String(item.priceMode || (item.formData && item.formData.priceMode) || '');
    if (acc > 0 && mode === 'manual') {
        (out as SavedPricing).manualUnitPrice = line.toFixed(2);
        if (item.formData) (out as SavedPricing).formData = { ...item.formData, manualUnitPrice: line.toFixed(2) };
        foldedManual = true;
    }
    return { item: out, foldedManual };
}
