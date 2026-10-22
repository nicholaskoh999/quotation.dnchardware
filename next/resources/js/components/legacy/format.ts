/* Display formatting for the legacy read pages. Presentation only: it never
   computes a price, a weight or a size — those arrive finished from the
   server read layer. */

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
