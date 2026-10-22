/* Day-first DNC dates (Session E §22). Stored ISO (yyyy-mm-dd), shown and
   typed DD-MM-YYYY (DD/MM/YYYY accepted). Never month-first. */

const pad = (n: number) => String(n).padStart(2, '0');

export function todayIso(now: Date = new Date()): string {
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** yyyy-mm-dd → DD-MM-YYYY ('' stays ''). */
export function formatDayFirst(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (1–2 digit day and month) → yyyy-mm-dd,
 * or null when it is not a real calendar date.
 */
export function parseDayFirst(text: string): string | null {
    const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$/.exec(text);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
}
