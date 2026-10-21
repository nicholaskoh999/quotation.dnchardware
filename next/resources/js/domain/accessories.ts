import { isMaterialOptionText } from './material';
import { type NumericInput, isBlank } from './numbers';
import { roundMoney2 } from './rounding';

/* Accessories (handoff §18): Nut · Flat Washer · Custom, priced per item and
   carried INSIDE the final unit price (PROJECT-GUARDRAILS "ACCESSORIES —
   INSIDE THE FINAL UNIT PRICE"). Customer output names them as wording only.

   LOCKED bug fix (B-1, §34 C-5): an explicit quantity 0 stays 0; only a blank
   quantity takes the default (nut 2, flat washer 1). A zero-quantity accessory
   contributes no money and no wording — no "cw 0nut" is invented. */

export const DEFAULT_NUT_QTY = 2;
export const DEFAULT_FW_QTY = 1;

/** The saved accessory shape (legacy item.accessories, read and written as-is). */
export interface CountedAccessory {
    enabled: boolean;
    qty: number;
    finish: string;
    unitPrice: number;
}
export interface CustomAccessory {
    enabled: boolean;
    text: string;
    unitPrice: number;
}
export interface ItemAccessories {
    nut: CountedAccessory;
    fw: CountedAccessory;
    custom: CustomAccessory;
}

/** What a form / Quick Add row supplies: an accessory is selected by being present. */
export interface AccessoryInput {
    nut?: { qty?: NumericInput; price?: NumericInput; unitPrice?: NumericInput; finish?: string | null } | null;
    fw?: { qty?: NumericInput; price?: NumericInput; unitPrice?: NumericInput; finish?: string | null } | null;
    custom?: { text?: string | null; price?: NumericInput; unitPrice?: NumericInput } | null;
}

/**
 * Read a "Qty per item" field. Blank ⇒ the default; an explicit number — including 0 — is kept.
 * Unreadable text falls back to the default, as legacy parseFloat(…)||default did.
 */
export function readAccessoryQty(raw: NumericInput, fallback: number): number {
    if (isBlank(raw)) return fallback;
    const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    return Number.isNaN(n) ? fallback : n;
}

function readPrice(raw: NumericInput): number {
    if (isBlank(raw)) return 0;
    return (typeof raw === 'number' ? raw : Number.parseFloat(String(raw))) || 0;
}

export function noAccessories(): ItemAccessories {
    return {
        nut: { enabled: false, qty: DEFAULT_NUT_QTY, finish: '', unitPrice: 0 },
        fw: { enabled: false, qty: DEFAULT_FW_QTY, finish: '', unitPrice: 0 },
        custom: { enabled: false, text: '', unitPrice: 0 },
    };
}

/** Build the saved accessory shape from a form / Quick Add selection. */
export function buildAccessories(input: AccessoryInput | null | undefined): ItemAccessories {
    const acc = noAccessories();
    if (!input) return acc;
    if (input.nut) {
        acc.nut = {
            enabled: true,
            qty: readAccessoryQty(input.nut.qty, DEFAULT_NUT_QTY),
            finish: String(input.nut.finish ?? ''),
            unitPrice: readPrice(input.nut.unitPrice ?? input.nut.price),
        };
    }
    if (input.fw) {
        acc.fw = {
            enabled: true,
            qty: readAccessoryQty(input.fw.qty, DEFAULT_FW_QTY),
            finish: String(input.fw.finish ?? ''),
            unitPrice: readPrice(input.fw.unitPrice ?? input.fw.price),
        };
    }
    if (input.custom) {
        acc.custom = {
            enabled: true,
            text: String(input.custom.text ?? '').trim(),
            unitPrice: readPrice(input.custom.unitPrice ?? input.custom.price),
        };
    }
    return acc;
}

type AnyAcc = Partial<{ nut: Partial<CountedAccessory>; fw: Partial<CountedAccessory>; custom: Partial<CustomAccessory> }> | null | undefined;

/** Legacy `accAddon`: Σ accessories per item (unrounded). */
export function accessoryUnitTotal(acc: AnyAcc): number {
    if (!acc) return 0;
    let addon = 0;
    if (acc.nut && acc.nut.enabled) addon += (acc.nut.qty || 0) * (acc.nut.unitPrice || 0);
    if (acc.fw && acc.fw.enabled) addon += (acc.fw.qty || 0) * (acc.fw.unitPrice || 0);
    if (acc.custom && acc.custom.enabled) addon += acc.custom.unitPrice || 0;
    return addon;
}

/** The accessory charge per item as a money figure (two decimals). */
export function accessoryUnitPrice(acc: AnyAcc): number {
    return roundMoney2(accessoryUnitTotal(acc));
}

/* A counted accessory takes part in wording only when it is selected with a
   quantity above zero. A saved legacy record never holds 0 (legacy turned it
   into the default), so the legacy `qty||default` reading is kept for a
   missing quantity on an old record. */
function countedQty(a: Partial<CountedAccessory> | undefined, fallback: number): number | null {
    if (!a || !a.enabled) return null;
    const q = a.qty === undefined || a.qty === null ? fallback : Number(a.qty);
    return q > 0 ? q : null;
}

function hasAnyAccessory(acc: AnyAcc): boolean {
    if (!acc) return false;
    return countedQty(acc.nut, DEFAULT_NUT_QTY) !== null || countedQty(acc.fw, DEFAULT_FW_QTY) !== null || !!(acc.custom && acc.custom.enabled);
}

/** Legacy `accCWLines` with the zero-quantity fix: e.g. ['cw 2nut & 1fw', 'cw welding']. */
export function accessoryWordingLines(acc: AnyAcc): string[] {
    if (!acc) return [];
    const lines: string[] = [];
    const parts: string[] = [];
    const nut = countedQty(acc.nut, DEFAULT_NUT_QTY);
    const fw = countedQty(acc.fw, DEFAULT_FW_QTY);
    if (nut !== null) parts.push(`${nut}nut`);
    if (fw !== null) parts.push(`${fw}fw`);
    if (parts.length) lines.push('cw ' + parts.join(' & '));
    const customText = acc.custom && acc.custom.text ? String(acc.custom.text).trim() : '';
    if (acc.custom && acc.custom.enabled && customText && !isMaterialOptionText(customText)) lines.push('cw ' + customText);
    return lines;
}

/**
 * Customer wording for an item's accessories (`cw 2nut & 1fw`).
 * null  — the item has no accessory at all (none selected, or only zero-quantity ones);
 * ''    — it has accessories, none of which carries customer wording (e.g. custom text that is a material label).
 */
export function accessoryWording(acc: AnyAcc): string | null {
    if (!hasAnyAccessory(acc)) return null;
    return accessoryWordingLines(acc).join('\n');
}

/** Legacy `wasCWLabel` (Welding Anchor Set: one line, custom joined with " + "), with the zero-quantity fix. */
export function wasAccessoryWording(acc: AnyAcc): string {
    if (!acc) return '';
    const parts: string[] = [];
    const nut = countedQty(acc.nut, DEFAULT_NUT_QTY);
    const fw = countedQty(acc.fw, DEFAULT_FW_QTY);
    if (nut !== null) parts.push(`${nut}nut`);
    if (fw !== null) parts.push(`${fw}fw`);
    let line = parts.length ? 'cw ' + parts.join(' & ') : '';
    const custom = acc.custom && acc.custom.enabled && acc.custom.text ? String(acc.custom.text).trim() : '';
    if (custom && !isMaterialOptionText(custom)) line += (line ? ' + ' : 'cw ') + custom;
    return line;
}

/** Compact internal summary (§18): "Nut ×2 · ZP · RM0.20" — one entry per selected accessory. */
export function accessorySummary(acc: AnyAcc): string[] {
    if (!acc) return [];
    const out: string[] = [];
    const money = (v: number | undefined): string => 'RM' + (Number(v) || 0).toFixed(2);
    const counted = (label: string, a: Partial<CountedAccessory> | undefined): void => {
        if (!a || !a.enabled) return;
        out.push([`${label} ×${a.qty ?? 0}`, a.finish || '', money(a.unitPrice)].filter(Boolean).join(' · '));
    };
    counted('Nut', acc.nut);
    counted('Flat Washer', acc.fw);
    if (acc.custom && acc.custom.enabled) out.push([acc.custom.text || 'Custom', money(acc.custom.unitPrice)].filter(Boolean).join(' · '));
    return out;
}
