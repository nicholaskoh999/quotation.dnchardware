import { parseMaterial, toLegacyMaterialCode } from './material';
import { normalizeSizeValue } from './size';
import { DIA_FULLSIZE, DIA_UNDERSIZE, DIA_UNDERSIZE_INCH } from './tables';

/* Code built-in default pricing (production `default_prices` has 0 rows, §16).

   Legacy getSystemDPRules / findDPMatch, with ONE owner-approved change:
   B-2 — MS FULLSIZE Sag Rod suggested Cost Rate PL 3.50 · ZP 5.00 · HDG 6.50.
   The HDG Additional Cost 1.60 (thread brushing) is legacy and is kept; §16
   restates only the Cost Rate. MS UNDERSIZE keeps the proven legacy
   2.80 / 4.20 / 6.00 (+1.60). A rate is ONE number — never a range. */

export type DefaultFinish = 'PL' | 'ZP' | 'HDG';

/** Legacy RATES — MS Sag Rod, kept for UNDERSIZE. */
export const MS_SAGROD_UNDERSIZE_RATES: Readonly<Record<DefaultFinish, number>> = { PL: 2.8, ZP: 4.2, HDG: 6.0 };
/** Owner B-2 (§16) — MS FULLSIZE Sag Rod suggested Cost Rate. */
export const MS_SAGROD_FULLSIZE_RATES: Readonly<Record<DefaultFinish, number>> = { PL: 3.5, ZP: 5.0, HDG: 6.5 };
/** HDG thread brushing Additional Cost on MS Sag Rod (legacy, both size types). */
export const MS_SAGROD_HDG_ADD_COST = 1.6;

/** UI hint only (§16). Never parsed, never stored as a rate. */
export const MS_FULLSIZE_HDG_RATE_HINT = 'Typical historical range RM6.50–RM7.00/kg';

/** Legacy RATES_4140 (4140 QT Sag Rod), PL rate + PL add cost. */
export const RATES_4140: Readonly<Record<'FULLSIZE' | 'UNDERSIZE', Readonly<Record<string, { plRate: number; addCostPL: number }>>>> = {
    FULLSIZE: { M12: { plRate: 8.5, addCostPL: 2.5 }, M16: { plRate: 6.5, addCostPL: 3.5 } },
    UNDERSIZE: { M12: { plRate: 9.5, addCostPL: 2.0 }, M16: { plRate: 8.0, addCostPL: 2.5 } },
};
export const ZP_SURCHARGE = 1.5;
export const HDG_SURCHARGE = 3.2;
export const HDG_THREAD_BRUSHING = 1.0;

export interface DefaultPriceRule {
    type: string;
    /** Legacy stored material code ('MS', '4140', …). */
    material: string;
    sizeType: string;
    size: string;
    finish: string;
    costRate: number;
    addCost: number;
    markup: number;
    source: 'system' | 'custom';
    active?: boolean;
}

export interface DefaultPrice {
    costRate: number;
    addCost: number;
    markup: number;
    source: 'system' | 'custom';
}

function rule(type: string, material: string, sizeType: string, size: string, finish: string, costRate: number, addCost: number): DefaultPriceRule {
    return { type, material, sizeType, size: size.toUpperCase(), finish, costRate, addCost, markup: 0, source: 'system', active: true };
}

/** The built-in rule list, in legacy order. */
export function systemDefaultPriceRules(): DefaultPriceRule[] {
    const rows: DefaultPriceRule[] = [];
    const addMS = (sizeType: 'FULLSIZE' | 'UNDERSIZE', size: string): void => {
        const rates = sizeType === 'FULLSIZE' ? MS_SAGROD_FULLSIZE_RATES : MS_SAGROD_UNDERSIZE_RATES;
        (['PL', 'ZP', 'HDG'] as const).forEach((finish) => {
            rows.push(rule('sagrod', 'MS', sizeType, size, finish, rates[finish], finish === 'HDG' ? MS_SAGROD_HDG_ADD_COST : 0));
        });
    };
    Object.keys(DIA_FULLSIZE).forEach((s) => addMS('FULLSIZE', s));
    Object.keys(DIA_UNDERSIZE).forEach((s) => addMS('UNDERSIZE', s));
    Object.keys(DIA_UNDERSIZE_INCH).forEach((s) => addMS('UNDERSIZE', s));
    (['FULLSIZE', 'UNDERSIZE'] as const).forEach((sizeType) => {
        Object.entries(RATES_4140[sizeType]).forEach(([size, row]) => {
            rows.push(rule('sagrod', '4140', sizeType, size, 'PL', row.plRate, row.addCostPL));
            rows.push(rule('sagrod', '4140', sizeType, size, 'ZP', row.plRate + ZP_SURCHARGE, row.addCostPL));
            rows.push(rule('sagrod', '4140', sizeType, size, 'HDG', row.plRate + HDG_SURCHARGE, row.addCostPL + HDG_THREAD_BRUSHING));
        });
    });
    return rows;
}

function dpKey(r: DefaultPriceRule): string {
    const noST = r.type === 'stud';
    return [r.type, r.material || '', noST ? '' : r.sizeType || '', (r.size || '').toUpperCase(), r.finish || ''].join('|');
}

/** Legacy getDPDisplayRules: system rules, then custom rules replacing any with the same identity. */
export function mergedDefaultPriceRules(custom: readonly DefaultPriceRule[] = []): DefaultPriceRule[] {
    const merged = new Map<string, DefaultPriceRule>();
    systemDefaultPriceRules().forEach((r) => merged.set(dpKey(r), r));
    custom.forEach((r) => merged.set(dpKey(r), { ...r, source: 'custom' }));
    return Array.from(merged.values());
}

function legacyCode(material: unknown): string {
    const raw = String(material ?? '');
    const sm = parseMaterial(raw);
    return sm ? (toLegacyMaterialCode(sm) ?? raw) : raw;
}

/**
 * Legacy `findDPMatch`: the default Cost Rate / Additional Cost / Markup for an item identity,
 * or null when no rule applies. Material may be a legacy code or a canonical / structured material.
 */
export function findDefaultPrice(
    type: string,
    material: unknown,
    sizeType: string | null | undefined,
    size: unknown,
    finish: string | null | undefined,
    customRules: readonly DefaultPriceRule[] = [],
): DefaultPrice | null {
    const mat = legacyCode(material);
    const isSS = mat === 'SS304' || mat === 'SS316';
    const skipSizeType = type === 'stud';
    const cSize = normalizeSizeValue(size).toUpperCase().trim();
    const hit = mergedDefaultPriceRules(customRules)
        .filter((r) => r.active !== false)
        .find((r) => {
            if (r.type !== type) return false;
            if (r.material !== mat) return false;
            if (!skipSizeType && r.sizeType !== (sizeType ?? '')) return false;
            const rSize = (r.size || '').toUpperCase().trim();
            if (rSize && rSize !== cSize) return false;
            if (!isSS) {
                const rFinish = r.finish || '';
                if (rFinish && rFinish !== (finish ?? '')) return false;
            }
            return true;
        });
    return hit ? { costRate: hit.costRate, addCost: hit.addCost, markup: hit.markup, source: hit.source } : null;
}

/* ── Sag Rod thread-length Additional Cost (legacy getAddCostFromTL) ───────
   Max end 30–120 ⇒ 0.60; >120–200 ⇒ 1.00; else 0. */
export function tlSurcharge(threadLen: unknown): number {
    const s = String(threadLen ?? '');
    if (!s || !s.trim()) return 0;
    const parts = s
        .split('/')
        .map((v) => Number.parseFloat(v.trim()))
        .filter((n) => !Number.isNaN(n));
    if (!parts.length) return 0;
    const max = Math.max(...parts);
    if (max >= 30 && max <= 120) return 0.6;
    if (max > 120 && max <= 200) return 1.0;
    return 0;
}

/* The legacy form applies the TL surcharge only to a material it has rates for
   (not the "manual rate" materials) and never to HDG (legacy onThreadLenChange). */
const TL_SURCHARGE_EXCLUDED_MATERIALS = ['S45C', 'S45C_HARDEN_G8_8', 'SS304', 'SS316', '4340', '4140', '4140_HARDEN_G10_9', '4140_PLAIN', 'Y_BAR'];

export function tlSurchargeApplies(material: unknown, finish: string | null | undefined): boolean {
    return !TL_SURCHARGE_EXCLUDED_MATERIALS.includes(legacyCode(material)) && finish !== 'HDG';
}
