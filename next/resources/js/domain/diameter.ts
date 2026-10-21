import { parseMaterial } from './material';
import { inchKey, imperialFullsizeDiameter, nominalDiameter, sizeDisplay } from './size';
import { cleanNum } from './numbers';
import { DIA_FULLSIZE, DIA_FULLSIZE_SPECIAL, DIA_UNDERSIZE, DIA_UNDERSIZE_INCH, lookup } from './tables';

/* Diameter master (handoff §15, R0b §4).

   Built-in tables exactly as legacy dcBuiltInDiameter, with ONE owner-approved
   change: B-3 — 4140 plain M12 FULLSIZE is Ø13 (legacy gated the special on
   4140 QT / 4340 QT only). Gate OG-1 (UNDERSIZE M12 10.6 vs 10.7) and the
   DG-1 candidates are NOT applied; they are exported as data below. */

export { DIA_FULLSIZE, DIA_FULLSIZE_SPECIAL, DIA_UNDERSIZE, DIA_UNDERSIZE_INCH } from './tables';

/* Materials whose FULLSIZE M12 is cut from the special 13 mm bar.
   4140 QT / 4340 QT: legacy. 4140 (plain): owner B-3, §15 LOCKED.
   Only the plain base material qualifies: a hardened 4140 QT (legacy code
   4140_HARDEN_G10_9) kept legacy's Ø12 — see NOTES gate OG-B2. */
const SPECIAL_FULLSIZE_MATERIALS = ['4140 QT', '4340 QT', '4140'];

function usesSpecialFullsize(material: unknown): boolean {
    const sm = parseMaterial(material);
    return !!sm && sm.treatment === null && SPECIAL_FULLSIZE_MATERIALS.includes(sm.material);
}

/**
 * Built-in diameter (mm) for a product / material / size type / size, or null when there is none.
 * Stud always reads the undersize bar; UNDERSIZE inch never falls back to the fullsize inch table.
 * `material` may be a legacy code ('4140', '4140_PLAIN') or a canonical / structured material.
 */
export function builtInDiameter(type: string, material: unknown, sizeType: string | null | undefined, size: unknown): number | null {
    const s = String(size ?? '').trim();
    if (!s) return null;
    const ik = inchKey(s);
    if (type === 'stud' || sizeType === 'UNDERSIZE') {
        const a = lookup(DIA_UNDERSIZE_INCH, s);
        if (a !== undefined) return a;
        const b = ik ? lookup(DIA_UNDERSIZE_INCH, ik) : undefined;
        if (b !== undefined) return b;
        const c = lookup(DIA_UNDERSIZE, s);
        return c === undefined ? null : c;
    }
    const special = lookup(DIA_FULLSIZE_SPECIAL, s);
    if (usesSpecialFullsize(material) && special !== undefined) return special;
    const full = lookup(DIA_FULLSIZE, s);
    if (full !== undefined) return full;
    return imperialFullsizeDiameter(s);
}

/* ── Custom override rules (legacy Diameter Settings semantics) ────────────
   A configured rule outranks the built-in table, always. Matching is legacy
   findDSRule: same product; a rule's blank material / size type / size is a
   wildcard; stud ignores size type; size compares case-insensitively. The
   first matching rule wins. */
export interface DiameterRule {
    type: string;
    material?: string;
    sizeType?: string;
    size?: string;
    diameter: number;
}

const NO_SIZE_TYPE_RULE_TYPES = ['stud'];

function sameMaterial(ruleMaterial: string, material: unknown): boolean {
    if (ruleMaterial === String(material ?? '')) return true;
    const a = parseMaterial(ruleMaterial);
    const b = parseMaterial(material);
    return !!a && !!b && a.material === b.material && a.treatment === b.treatment && a.propertyClass === b.propertyClass;
}

export function findDiameterRule(
    rules: readonly DiameterRule[],
    type: string,
    material: unknown,
    sizeType: string | null | undefined,
    size: unknown,
): DiameterRule | null {
    const noST = NO_SIZE_TYPE_RULE_TYPES.includes(type);
    const s = String(size ?? '').toUpperCase();
    return (
        rules.find((r) => {
            if (r.type !== type) return false;
            if (r.material && !sameMaterial(r.material, material)) return false;
            if (!noST && r.sizeType && r.sizeType !== (sizeType ?? '')) return false;
            if (r.size && r.size.toUpperCase() !== s) return false;
            return true;
        }) ?? null
    );
}

export interface EffectiveDiameter {
    diameter: number | null;
    source: 'custom' | 'built_in' | 'none';
}

/** Legacy `dcEffectiveDiameter`: a custom rule, else the built-in table. */
export function effectiveDiameter(
    type: string,
    material: unknown,
    sizeType: string | null | undefined,
    size: unknown,
    rules: readonly DiameterRule[] = [],
): EffectiveDiameter {
    const rule = findDiameterRule(rules, type, material, sizeType, size);
    if (rule) return { diameter: Number.parseFloat(String(rule.diameter)), source: 'custom' };
    const d = builtInDiameter(type, material, sizeType, size);
    return d === null ? { diameter: null, source: 'none' } : { diameter: d, source: 'built_in' };
}

/**
 * Legacy `formatSizeLabel`: `Ø<bar>-<size>` only for a fullsize bar more than 0.2 mm off the
 * nominal (never for UNDERSIZE); otherwise the display size.
 */
export function formatSizeLabel(size: unknown, diameter: unknown, sizeType?: string | null): string {
    const shown = sizeDisplay(size);
    const d = Number.parseFloat(String(diameter));
    if (!size || !d) return shown;
    if ((sizeType || 'FULLSIZE') === 'UNDERSIZE') return shown;
    const bar = cleanNum(Math.round(d * 10) / 10);
    const nominal = nominalDiameter(size);
    if (nominal === null) return 'Ø' + bar + '-' + shown;
    return Math.abs(d - nominal) > 0.2 ? 'Ø' + bar + '-' + shown : shown;
}

/* ── §15 candidates — documented, NOT applied ──────────────────────────────
   Repeated historical conventions the owner named. Their scope cannot be
   proven from repository evidence (the read-only export was never committed),
   so the engine keeps the legacy value and lists them here for the gate. */
export interface DiameterCandidate {
    id: string;
    status: 'candidate';
    gate: 'OG-1' | 'DG-1';
    scope: { type?: string; material?: string; sizeType?: string; size: string };
    legacy: number;
    candidate: number | readonly number[];
    applied: false;
    note: string;
}

export const DIAMETER_CANDIDATES: readonly DiameterCandidate[] = [
    {
        id: 'undersize-m12-10.7', status: 'candidate', gate: 'OG-1', scope: { sizeType: 'UNDERSIZE', size: 'M12' },
        legacy: 10.6, candidate: 10.7, applied: false,
        note: 'Only scoped evidence ties 10.7 to 4140 QT UNDERSIZE Sag Rod M12; a global change moves the weight (and price) of the most common line by ~1.9%. §34 C-2.',
    },
    {
        id: 'fullsize-m33-32', status: 'candidate', gate: 'DG-1', scope: { sizeType: 'FULLSIZE', size: 'M33' },
        legacy: 33, candidate: 32, applied: false, note: '§15 repeated convention; scope unproven without the historical export.',
    },
    {
        id: 'fullsize-m24-25', status: 'candidate', gate: 'DG-1', scope: { sizeType: 'FULLSIZE', size: 'M24' },
        legacy: 24, candidate: 25, applied: false, note: '§15 repeated convention; scope unproven without the historical export.',
    },
    {
        id: 'inch-1-25', status: 'candidate', gate: 'DG-1', scope: { sizeType: 'FULLSIZE', size: '1"' },
        legacy: 25.4, candidate: 25, applied: false, note: '§15 repeated convention; legacy 25.4 kept until scoped.',
    },
    {
        id: 'undersize-m10-8.9-9.0', status: 'candidate', gate: 'DG-1', scope: { sizeType: 'UNDERSIZE', size: 'M10' },
        legacy: 8.8, candidate: [8.9, 9.0], applied: false, note: 'Two values in the evidence; legacy 8.8 kept.',
    },
    {
        id: '4140qt-lbolt-m27-28', status: 'candidate', gate: 'DG-1',
        scope: { type: 'lbolt', material: '4140 QT', sizeType: 'FULLSIZE', size: 'M27' },
        legacy: 27, candidate: 28, applied: false, note: 'Scoped candidate; legacy 27 kept until the export proves the scope.',
    },
];
