import { type NumericInput, isBlank, parseNum } from './numbers';
import type { ProductType } from './products';
import { plateWeight, rodWeight, trianglePlateWeight } from './weight';

/* Developed length (the length of bar a bent product is cut from) and the
   resulting unit weight, per product.

     Sag Rod / Stud / Anchor Bolt   L (straight; no developed length)
     U-Bolt                         ceil((d+ID)×1.57 + 2·IH − ID)
     SQ U-Bolt                      ceil(((W/2+OH) − 1.5d) × 2)
     L Bolt                         ceil(L + W − 1.5d)
     L Bolt 45°                     no formula — manual only (blank ⇒ 0 kg)
     J Bolt                         ceil((H−S) + (d+ID)×1.57 + 2(S−d) − ID)
     J Hook (§19)                   no formula — manual; L + W offered as an editable SUGGESTION
     Eye Bolt (§20)                 with S: J Bolt formula with H := L as an editable SUGGESTION
                                    (gate OG-2); without S: manual
   A typed (manual) developed length is weighed ceil()ed — bar is bought in
   whole millimetres — exactly as legacy. A formula result ≤ 0 is no length. */

export interface GeometryInput {
    product: ProductType;
    diameter?: NumericInput;
    /** Straight length (Sag Rod 'length'; Stud / Anchor / L / J Hook / Eye Bolt 'l'). */
    length?: NumericInput;
    l?: NumericInput;
    w?: NumericInput;
    h?: NumericInput;
    id?: NumericInput;
    ih?: NumericInput;
    oh?: NumericInput;
    s?: NumericInput;
    /** Plate dimensions. */
    plateType?: 'ms_plate' | 'triangle_plate';
    t?: NumericInput;
    triL?: NumericInput;
    triH?: NumericInput;
    triT?: NumericInput;
    /** A typed developed (total) length. Outranks any formula / suggestion. */
    developedLength?: NumericInput;
    /** Others: a typed unit weight (weight mode 'manual'). */
    unitWeight?: NumericInput;
}

export type DevelopedLengthSource = 'straight' | 'formula' | 'manual' | 'none' | 'plate' | 'unit_weight';

export interface GeometryResult {
    /** The developed length the item carries (formula or typed), null for straight / plate products or when absent. */
    developedLength: number | null;
    /** The length actually weighed (ceil of a developed length; L for straight products). */
    weighedLength: number;
    /** An editable suggestion (J Hook L+W, Eye Bolt J-formula). Never applied by the engine. */
    suggestedDevelopedLength: number | null;
    source: DevelopedLengthSource;
    weight: number;
}

const STRAIGHT: readonly ProductType[] = ['sagrod', 'stud', 'anchorbolt'];

/** U-Bolt developed length, or null when the formula gives ≤ 0. */
export function uBoltDevelopedLength(d: number, id: number, ih: number): number | null {
    const v = Math.ceil((d + id) * 1.57 + 2 * ih - id);
    return v > 0 ? v : null;
}
export function sqUBoltDevelopedLength(d: number, oh: number, w: number): number | null {
    const v = Math.ceil((w / 2 + oh - d * 1.5) * 2);
    return v > 0 ? v : null;
}
export function lBoltDevelopedLength(d: number, l: number, w: number): number | null {
    const v = Math.ceil(l + w - d * 1.5);
    return v > 0 ? v : null;
}
export function jBoltDevelopedLength(d: number, h: number, id: number, s: number): number | null {
    const upper = h - s;
    const lower = (d + id) * 1.57 + (s - d) + (s - d) - id;
    const v = Math.ceil(upper + lower);
    return v > 0 ? v : null;
}

/** §19: J Hook suggested developed length = L + W (editable suggestion, never forced). */
export function jHookSuggestedDevelopedLength(l: NumericInput, w: NumericInput): number | null {
    const L = parseNum(l);
    const W = parseNum(w);
    return L > 0 && W > 0 ? L + W : null;
}

/** §20 / OG-2: Eye Bolt with S — the J Bolt formula with H := L, as an editable suggestion. Without S: null. */
export function eyeBoltSuggestedDevelopedLength(d: NumericInput, l: NumericInput, id: NumericInput, s: NumericInput): number | null {
    if (isBlank(s) || !(parseNum(s) > 0)) return null;
    return jBoltDevelopedLength(parseNum(d), parseNum(l), parseNum(id), parseNum(s));
}

function auto(product: ProductType, i: GeometryInput): number | null {
    const d = parseNum(i.diameter);
    switch (product) {
        case 'ubolt': {
            const id = parseNum(i.id);
            const ih = parseNum(i.ih);
            return d > 0 || id > 0 || ih > 0 ? uBoltDevelopedLength(d, id, ih) : null;
        }
        case 'squbolt': {
            const oh = parseNum(i.oh);
            const w = parseNum(i.w);
            return d > 0 || oh > 0 || w > 0 ? sqUBoltDevelopedLength(d, oh, w) : null;
        }
        case 'lbolt': {
            const l = parseNum(i.l ?? i.length);
            const w = parseNum(i.w);
            return l > 0 || w > 0 || d > 0 ? lBoltDevelopedLength(d, l, w) : null;
        }
        case 'jbolt': {
            const h = parseNum(i.h);
            const id = parseNum(i.id);
            const s = parseNum(i.s);
            return d > 0 || h > 0 || id > 0 || s > 0 ? jBoltDevelopedLength(d, h, id, s) : null;
        }
        default:
            return null;
    }
}

/** Developed length + unit weight for one item. */
export function computeGeometry(i: GeometryInput): GeometryResult {
    const p = i.product;
    const d = parseNum(i.diameter);

    if (STRAIGHT.includes(p)) {
        const L = parseNum(i.length ?? i.l);
        return { developedLength: null, weighedLength: L, suggestedDevelopedLength: null, source: 'straight', weight: rodWeight(d, L) };
    }
    if (p === 'plate') {
        const weight = i.plateType === 'triangle_plate'
            ? trianglePlateWeight(parseNum(i.triL), parseNum(i.triH), parseNum(i.triT))
            : plateWeight(parseNum(i.l), parseNum(i.w), parseNum(i.t));
        return { developedLength: null, weighedLength: 0, suggestedDevelopedLength: null, source: 'plate', weight };
    }
    if (p === 'others') {
        if (!isBlank(i.unitWeight)) {
            return { developedLength: null, weighedLength: 0, suggestedDevelopedLength: null, source: 'unit_weight', weight: parseNum(i.unitWeight) };
        }
        const L = parseNum(i.length);
        return { developedLength: null, weighedLength: L, suggestedDevelopedLength: null, source: 'straight', weight: rodWeight(d, L) };
    }
    if (p === 'was') {
        throw new Error('computeGeometry: a Welding Anchor Set is weighed with wasWeights()');
    }

    let suggested: number | null = null;
    if (p === 'jhook') suggested = jHookSuggestedDevelopedLength(i.l ?? i.length, i.w);
    if (p === 'eyebolt') suggested = eyeBoltSuggestedDevelopedLength(i.diameter, i.l ?? i.length, i.id, i.s);

    if (!isBlank(i.developedLength)) {
        const typed = parseNum(i.developedLength);
        const weighed = Math.ceil(typed || 0);
        return {
            developedLength: typed,
            weighedLength: weighed,
            suggestedDevelopedLength: suggested,
            source: 'manual',
            weight: rodWeight(d, weighed),
        };
    }
    const formula = auto(p, i);
    if (formula !== null) {
        return { developedLength: formula, weighedLength: formula, suggestedDevelopedLength: suggested, source: 'formula', weight: rodWeight(d, formula) };
    }
    return { developedLength: null, weighedLength: 0, suggestedDevelopedLength: suggested, source: 'none', weight: 0 };
}
