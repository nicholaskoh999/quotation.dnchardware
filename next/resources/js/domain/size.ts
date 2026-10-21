import { DIA_FULLSIZE, DIA_UNDERSIZE, DIA_UNDERSIZE_INCH, INCH_FULLSIZE_DIA, lookup } from './tables';

/* Size reading (handoff §12) on top of faithful ports of the legacy readers
   normalizeSizeValue / isKnownSize / wqaInchKey / wqaImperialDia / sizeDisplay /
   getNominalDiameter. */

/** Legacy `normalizeSizeValue`: what the person WROTE, in canonical spelling. */
export function normalizeSizeValue(raw: unknown): string {
    const v = String(raw ?? '').trim().toUpperCase();
    if (!v) return '';
    let m = /^M?\s*(\d+(?:\.\d+)?)\s*(?:MM)?$/.exec(v);
    if (m) return 'M' + String(Number(m[1])).replace(/\.0$/, '');
    m = /^(\d+\s*[-\s]\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*(?:"|”|″|IN|INCH(?:ES)?)?$/.exec(v);
    if (m) return String(m[1]).replace(/\s*\/\s*/, '/').replace(/\s*[-\s]\s*/, '-');
    m = /^(\d+)\s*(?:"|”|″|IN|INCH(?:ES)?)$/.exec(v);
    if (m) return m[1] + '"';
    return v;
}

/** Legacy `wqaInchKey`: the inch size reduced to the key the diameter tables use ('' if not an inch size). */
export function inchKey(size: unknown): string {
    const s = String(size ?? '').trim().toUpperCase();
    const mark = '(?:\\s*(?:"|”|″|IN\\b|INCH(?:ES)?\\b))';
    const m = new RegExp('^(\\d+\\s*[-\\s]\\s*\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+)' + mark + '?' + '|^(\\d+)' + mark).exec(s);
    if (!m) return '';
    return String(m[1] !== undefined ? m[1] : m[2]).replace(/\s*\/\s*/, '/').replace(/\s*[-\s]\s*/, '-');
}

/** Legacy `wqaImperialDia`: the FULLSIZE inch diameter (mm), or null. */
export function imperialFullsizeDiameter(size: unknown): number | null {
    const key = inchKey(size);
    if (!key) return null;
    const d = lookup(INCH_FULLSIZE_DIA, key);
    return d === undefined ? null : d;
}

/** Legacy `isKnownSize`: a size the quotation can be built from. */
export function isKnownSize(size: unknown): boolean {
    const s = String(size ?? '').trim();
    if (!s) return false;
    if (lookup(DIA_FULLSIZE, s) !== undefined || lookup(DIA_UNDERSIZE, s) !== undefined) return true;
    if (lookup(DIA_UNDERSIZE_INCH, s) !== undefined) return true;
    const up = s.toUpperCase();
    if (lookup(DIA_FULLSIZE, up) !== undefined || lookup(DIA_UNDERSIZE, up) !== undefined) return true;
    if (/[/"']/.test(s) && imperialFullsizeDiameter(s) !== null) return true;
    return false;
}

/** Legacy `getNominalDiameter`. */
export function nominalDiameter(size: unknown): number | null {
    const s = String(size ?? '');
    const d = lookup(DIA_FULLSIZE, s);
    if (d !== undefined) return d;
    const m = /^M(\d+(?:\.\d+)?)$/i.exec(s);
    if (m) return Number.parseFloat(String(m[1]));
    return null;
}

/** Legacy `sizeDisplay`: what the CUSTOMER reads — an inch fraction gains its mark. */
export function sizeDisplay(size: unknown): string {
    const s = String(size ?? '').trim();
    return /^\d+(?:-\d+)?\/\d+$/.test(s) ? s + '"' : s;
}

export type SizeSystem = 'metric' | 'imperial' | 'unknown';

export interface SizeInterpretation {
    /** What was typed. */
    input: string;
    /** Canonical spelling used for diameters, rules and history ('M12', '1/2', '1"'). */
    normalised: string;
    /** Customer-facing spelling ('M12', '1/2"', '1"'). */
    display: string;
    system: SizeSystem;
    /** The built-in tables / inch reader recognise it. */
    known: boolean;
    /** Unknown, empty or deliberately not normalised: a person must look at it. */
    needsReview: boolean;
    /** Why it needs review (null when it does not). */
    reviewReason: 'empty' | 'unknown_size' | 'bare_number_out_of_range' | null;
    /** Short interpretation chip, e.g. "M12 · Metric", "1/2\" · Imperial". */
    label: string;
}

/* The largest metric size in the built-in tables (M65). A BARE number beyond it
   is far more likely a length or a quantity than a rod size — the R0b Quick Add
   known failure reads a bare 72 as a length — so it is not turned into an
   M-size. This implements owner §12 "bare 72 ⇒ do not blindly normalise; mark
   Needs Review" without inventing a list: a bare 6 is still M6, a bare 23 is
   still M23 (read, then flagged unknown), an explicit M72 is still M72. */
export const MAX_METRIC_NOMINAL = Math.max(
    ...Object.keys(DIA_FULLSIZE)
        .concat(Object.keys(DIA_UNDERSIZE))
        .filter((k) => /^M\d/.test(k))
        .map((k) => Number(k.slice(1))),
);

const SYSTEM_LABEL: Record<SizeSystem, string> = { metric: 'Metric', imperial: 'Imperial', unknown: 'Needs Review' };

/** Handoff §12 size interpretation: canonical value, display, system and Needs Review. */
export function interpretSize(raw: unknown): SizeInterpretation {
    const input = String(raw ?? '');
    const trimmed = input.trim();
    const bare = /^(\d+(?:\.\d+)?)\s*(?:mm)?$/i.exec(trimmed);
    if (bare && Number(bare[1]) > MAX_METRIC_NOMINAL) {
        const normalised = String(bare[1]);
        return {
            input,
            normalised,
            display: normalised,
            system: 'unknown',
            known: false,
            needsReview: true,
            reviewReason: 'bare_number_out_of_range',
            label: `${normalised} · ${SYSTEM_LABEL.unknown}`,
        };
    }
    const normalised = normalizeSizeValue(input);
    const known = isKnownSize(normalised);
    const system: SizeSystem = /^M\d/.test(normalised) ? 'metric' : inchKey(normalised) ? 'imperial' : 'unknown';
    const display = sizeDisplay(normalised);
    const reviewReason = !normalised ? 'empty' : known ? null : 'unknown_size';
    return {
        input,
        normalised,
        display,
        system,
        known,
        needsReview: !known,
        reviewReason,
        label: normalised ? `${display} · ${known ? SYSTEM_LABEL[system] : SYSTEM_LABEL.unknown}` : '',
    };
}
