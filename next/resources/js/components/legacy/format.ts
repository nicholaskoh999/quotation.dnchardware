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
