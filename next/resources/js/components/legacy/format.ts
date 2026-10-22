/* Display formatting for the legacy read pages. Presentation only: it never
   computes a price or a size — those arrive finished from the server read
   layer. The one piece of arithmetic is the legacy item card's own display
   rule for weight (per-piece weight × qty, summed per group, 3 dp). */

import { parseMaterial, treatmentWording } from '@/domain/material';
import type { ItemSummary, MaterialReading, QuotationItem, ReadableItem } from '@/types/legacy';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "2026-03-01" → "1 Mar 2026"; anything unparseable is shown as given. */
export function formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!m) return value;
    return DATE_FMT.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/** A stored DECIMAL string ("1234.50") → "RM 1,234.50", without a float round-trip. */
export function formatStoredMoney(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const m = /^(-?)(\d+)\.(\d{2})$/.exec(value);
    if (!m) return `RM ${value}`;
    return `${m[1]}RM ${m[2]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${m[3]}`;
}

/** A unit price the server already rounded to 2 dp → "RM 12.30". */
export function formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const [int, frac] = Math.abs(value).toFixed(2).split('.');
    return `${value < 0 ? '-' : ''}RM ${int!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

export function orDash(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === '' ? '—' : String(value);
}

/* ── Saved item display (Owner Smoke #1 §3B / §3C) ──────────────────────────
   Presentation only: the stored description and size text are re-laid out,
   never re-interpreted. Every number shown is the stored number. */

const DIM_SEPARATOR = /\s+x\s+/i;
// A single labelled dimension as the legacy builders write it: "L 900", "TL 150mm",
// "W 70.5", and the sag rod's both-ends thread length "TL 100/100mm".
const LABELLED_DIM = /^([A-Z]{1,3})\s*(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)(?:\s*mm)?$/;
// The leading size token: "M20", "M20mm", "1/2\"".
const SIZE_TOKEN = /^(M\d+(?:\.\d+)?|\d+(?:\/\d+)?")(?:\s*mm)?$/i;

function formatDimensionLine(line: string): string {
    const trimmed = line.trim();
    if (!DIM_SEPARATOR.test(trimmed) && !LABELLED_DIM.test(trimmed)) return line;
    const parts = trimmed.split(DIM_SEPARATOR);
    const out: string[] = [];
    for (const part of parts) {
        const dim = LABELLED_DIM.exec(part);
        if (dim) {
            out.push(`${dim[1]}${dim[2]}`);
            continue;
        }
        const size = SIZE_TOKEN.exec(part);
        if (size) {
            out.push(size[1]!);
            continue;
        }
        // Anything else (e.g. "Ø18mm center hole", "150mm 45deg") is not a plain
        // dimension: leave the whole line exactly as stored.
        return line;
    }
    return out.join(' × ');
}

/**
 * Canonical dimension text: `M20 x L 900 x W 70 x TL 150mm` → `M20 × L900 × W70 × TL150`.
 * Multi-line sizes (Welding Anchor Sets) are formatted line by line; a line that
 * is not made only of plain dimensions is shown exactly as stored.
 */
export function formatDimensions(size: string | null | undefined): string {
    if (!size) return '';
    return size
        .split('\n')
        .map(formatDimensionLine)
        .join('\n');
}

export interface ItemTitleInput {
    displayDescription: string;
    productType: string | null;
    material: { label: string; legacyLabel: string; key: string | null; treatment: string | null } | null;
}

/** True when the item card shows the material as chips (so the title may drop it). */
export function showsMaterialChips(material: ItemTitleInput['material']): boolean {
    return material !== null && (material.treatment !== null || material.key !== null);
}

/**
 * Primary item title without the material prefix the legacy description
 * starts with (`4140 QT FULLSIZE L BOLT` → `FULLSIZE L BOLT`) — only when the
 * material is shown as chips beside it, so no wording is lost.
 */
export function itemTitle(item: ItemTitleInput): string {
    const full = (item.displayDescription || item.productType || 'Item').trim();
    const m = item.material;
    if (!m || !showsMaterialChips(m)) return full;
    const prefixes = [m.legacyLabel, m.label].filter((p) => p && p.trim() !== '').sort((a, b) => b.length - a.length);
    const upper = full.toUpperCase();
    for (const prefix of prefixes) {
        const p = prefix.trim().toUpperCase();
        if (upper.startsWith(p + ' ')) {
            const rest = full.slice(p.length).trim();
            if (rest !== '') return rest;
        }
    }
    return full;
}

/* ── Owner Smoke Loop #2: list item summary, detail grouping, weight ──────
   No colour chips for material / product / size type / finish: plain text
   hierarchy. No UOM: the system has no canonical UOM field yet, so
   quantities read `Qty 30`, never `30 pcs`.
   TODO(Wave 2): formal UOM field / semantics, designed with the Builder. */

/** A finish worth printing: blank, N/A, none and dashes print nothing (legacy chip rule). */
export function displayFinish(finish: string | null | undefined): string | null {
    const f = String(finish ?? '').trim();
    return /^(n\/?a|none|-|—)?$/i.test(f) ? null : f;
}

/**
 * List "Item Summary": the first item as Material + Size Type + Product
 * (+ hardened wording) · Finish — `4140 QT FULLSIZE L BOLT · PL`,
 * `S45C STUD · HARDENED TO G8.8 · PL` — plus how many other items there are,
 * which the list renders separately and muted as `+5 more` (Loop #3), so the
 * count never reads as part of the finish. Never dimensions, accessories,
 * weight or prices. null when nothing is readable.
 */
export function itemSummaryParts(summary: ItemSummary | null | undefined): { main: string; more: number } | null {
    if (!summary || !summary.first) return null;
    const f = summary.first;
    const sm = parseMaterial(f.material);
    let parts: string[];
    if (sm && f.productType) {
        const head = [sm.material, f.sizeType ?? '', f.productType].map((p) => p.trim()).filter(Boolean).join(' ');
        parts = [head, treatmentWording(sm) ?? '', displayFinish(f.finish) ?? ''];
    } else {
        parts = [f.displayDescription || f.productType || '', displayFinish(f.finish) ?? ''];
    }
    const main = parts.filter((p) => p !== '').join(' · ');
    if (main === '') return null;
    return { main, more: Math.max(0, summary.count - 1) };
}

/** `+5 more`, or null for a single item. */
export function moreLabel(more: number): string | null {
    return more > 0 ? `+${more} more` : null;
}

/** Plain-text material identity for a detail row: `4140 QT`, `S45C · HARDENED TO G8.8`. */
export function materialText(m: MaterialReading | null): string | null {
    if (!m || !showsMaterialChips(m)) return null;
    if (m.treatment === 'HARDEN') return `${m.label} · ${m.propertyClass ? `HARDENED TO G${m.propertyClass}` : 'HARDENED'}`;
    return m.label;
}

/** `4140 QT · PL` — material and finish as one plain line (either may be absent). */
export function itemIdentity(item: ReadableItem): string {
    return [materialText(item.material), displayFinish(item.finishLabel)].filter(Boolean).join(' · ');
}

/** Legacy item-card weight: stored per-piece weight × qty; null when there is none. */
export function lineWeight(item: ReadableItem): number | null {
    const w = item.weight;
    if (w === null || !Number.isFinite(w) || w <= 0) return null;
    return w * (item.qty ?? 0);
}

export function formatWeight(kg: number): string {
    return `${kg.toFixed(3)} kg`;
}

export type ItemOrder = 'oldest' | 'newest';

export interface ItemGroup {
    key: string;
    /** `FULLSIZE L BOLT` — Size Type + Product (the visual grouping key) */
    title: string;
    /**
     * The group heading (Loop #3): when every readable item shares material +
     * finish, the whole natural identity (`MS UNDERSIZE SAG ROD · ZP`);
     * otherwise just `title`, and each row carries its own material · finish.
     */
    heading: string;
    items: QuotationItem[];
    /** the material · finish line when every readable item in the group shares it */
    sharedIdentity: string | null;
    /** sum of the line weights when the group has more than one item and any weight */
    totalWeight: number | null;
}

const norm = (v: string | null | undefined) => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

function groupKey(item: QuotationItem): string {
    if (item.state !== 'ok') return `unreadable:${item.position}`;
    if (item.productType) return `${norm(item.sizeType)}|${norm(item.productType)}`;
    return `title:${norm(itemTitle(item))}`;
}

function groupTitle(item: QuotationItem): string {
    if (item.state !== 'ok') return '';
    if (item.productType) return [item.sizeType ?? '', item.productType].map((p) => p.trim()).filter(Boolean).join(' ');
    return itemTitle(item);
}

/**
 * Quotation detail groups: same Product + Size Type together, whatever the
 * material, finish or accessories. Order is presentation only — `newest`
 * reverses the saved order; every item keeps its original number
 * (`position`), and nothing is renumbered or re-saved.
 */
export function groupItems(items: QuotationItem[], order: ItemOrder = 'oldest'): ItemGroup[] {
    const ordered = order === 'newest' ? [...items].reverse() : items;
    const groups = new Map<string, ItemGroup>();
    for (const item of ordered) {
        const key = groupKey(item);
        let g = groups.get(key);
        if (!g) {
            g = { key, title: groupTitle(item), heading: groupTitle(item), items: [], sharedIdentity: null, totalWeight: null };
            groups.set(key, g);
        }
        g.items.push(item);
    }
    for (const g of groups.values()) {
        const readable = g.items.filter((i): i is ReadableItem => i.state === 'ok');
        const ids = new Set(readable.map(itemIdentity));
        g.sharedIdentity = readable.length > 0 && ids.size === 1 ? [...ids][0] || null : null;
        if (readable.length > 0 && ids.size === 1) g.heading = naturalTitle(readable[0]!, g.title);
        if (g.items.length > 1) {
            const weights = readable.map(lineWeight).filter((w): w is number => w !== null);
            const sum = weights.reduce((a, b) => a + b, 0);
            g.totalWeight = sum > 0 ? sum : null;
        }
    }
    return [...groups.values()];
}

/**
 * Overall Weight (Loop #4): the sum of every displayed line weight, shown
 * only when the quotation has more than one visual group (one group's own
 * Total Weight already says it) and there is any weight at all.
 */
export function overallWeight(groups: ItemGroup[]): number | null {
    const withItems = groups.filter((g) => g.items.some((i) => i.state === 'ok'));
    if (withItems.length < 2) return null;
    let sum = 0;
    for (const g of withItems) {
        for (const i of g.items) {
            if (i.state !== 'ok') continue;
            const w = lineWeight(i);
            if (w !== null) sum += w;
        }
    }
    return sum > 0 ? sum : null;
}

/**
 * Material + Size Type + Product (+ hardened wording) · Finish for one item:
 * `4140 QT FULLSIZE L BOLT · PL`, `S45C STUD · HARDENED TO G8.8 · PL`.
 * `title` is the item's Size Type + Product (or its material-free description).
 */
function naturalTitle(item: ReadableItem, title: string): string {
    const m = item.material;
    const material = m && showsMaterialChips(m) ? m.label : null;
    const treatment = m && m.treatment === 'HARDEN' ? (m.propertyClass ? `HARDENED TO G${m.propertyClass}` : 'HARDENED') : null;
    return [[material, title].filter(Boolean).join(' '), treatment, displayFinish(item.finishLabel)].filter(Boolean).join(' · ');
}

/** `+5%` — the stored markup as written (legacy `⭐ +${markup}%`). */
export function formatMarkup(percent: number): string {
    return `+${Number(percent.toFixed(4))}%`;
}
