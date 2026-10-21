import { type NumericInput, parseNum } from './numbers';

/* Unit weight (kg). Ports of the legacy formulas, operation order preserved. */

/** Steel rod: d² × L × 0.0000061654  (= π/4 × 7.85e-6). */
export const ROD_FACTOR = 0.0000061654;
/** Steel plate density factor (kg per mm³). */
export const PLATE_FACTOR = 0.00000785;

export function rodWeight(diameter: number, length: number): number {
    return diameter * diameter * length * ROD_FACTOR;
}

/** Rectangular plate: L × W × T × 0.00000785. */
export function plateWeight(l: number, w: number, t: number): number {
    return l * w * t * PLATE_FACTOR;
}

/** Triangle plate: L × H × T × 0.00000785 — no ½, characterised as legacy (R0b §2), not judged. */
export function trianglePlateWeight(l: number, h: number, t: number): number {
    return l * h * t * PLATE_FACTOR;
}

/* ── Welding Anchor Set ──────────────────────────────────────────────────── */
export interface WasWeightInput {
    anchorDiameter: NumericInput;
    anchorLength: NumericInput;
    anchorQty: NumericInput;
    basePlateL: NumericInput;
    basePlateW: NumericInput;
    basePlateT: NumericInput;
    basePlateQty: NumericInput;
    trianglePlateL?: NumericInput;
    trianglePlateH?: NumericInput;
    trianglePlateCL?: NumericInput;
    trianglePlateCH?: NumericInput;
    trianglePlateT?: NumericInput;
    trianglePlateQty?: NumericInput;
}

export interface WasWeights {
    setWeight: number;
    anchorWeight: number;
    basePlateWeight: number;
    trianglePlateWeight: number;
    /** Per-piece weights. */
    anchorPieceWeight: number;
    basePlatePieceWeight: number;
    trianglePlatePieceWeight: number;
    /** Triangle plates per set actually counted (0 when every triangle field is blank). */
    trianglePlateQty: number;
}

const blank = (v: NumericInput | undefined): boolean => v === undefined || v === null || String(v).trim() === '';

/** Legacy `calcWASWeights`. */
export function wasWeights(i: WasWeightInput): WasWeights {
    const abD = parseNum(i.anchorDiameter);
    const abL = parseNum(i.anchorLength);
    const abQty = Math.max(1, parseNum(i.anchorQty) || 1);
    const abW = abD * abD * abL * ROD_FACTOR;
    const bpQty = Math.max(1, parseNum(i.basePlateQty) || 1);
    const bpWt = parseNum(i.basePlateL) * parseNum(i.basePlateW) * parseNum(i.basePlateT) * PLATE_FACTOR;
    const tpFieldsBlank = [i.trianglePlateL, i.trianglePlateH, i.trianglePlateCL, i.trianglePlateCH, i.trianglePlateT].every(blank);
    const tpQty = tpFieldsBlank ? 0 : Math.max(0, parseNum(i.trianglePlateQty));
    const tpWt = parseNum(i.trianglePlateL) * parseNum(i.trianglePlateH) * parseNum(i.trianglePlateT) * PLATE_FACTOR;
    const anchorWeight = abW * abQty;
    const basePlateWeight = bpWt * bpQty;
    const trianglePlate = tpQty > 0 ? tpWt * tpQty : 0;
    return {
        setWeight: anchorWeight + basePlateWeight + trianglePlate,
        anchorWeight,
        basePlateWeight,
        trianglePlateWeight: trianglePlate,
        anchorPieceWeight: abW,
        basePlatePieceWeight: bpWt,
        trianglePlatePieceWeight: tpWt,
        trianglePlateQty: tpQty,
    };
}
