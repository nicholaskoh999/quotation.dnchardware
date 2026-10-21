/* Built-in master-data tables, exactly as the legacy index.php ships them.
   Kept in one module so size recognition, the diameter resolver and the
   default-price rules all read the same data. */

/** FULLSIZE bar diameter by size (mm). */
export const DIA_FULLSIZE: Readonly<Record<string, number>> = {
    M8: 8, M10: 10, M12: 12, M13: 13, M16: 16, M18: 18, M20: 20, M22: 22, M24: 24, M25: 25, M27: 27,
    M30: 30, M32: 32, M33: 33, M36: 36, M38: 38, M39: 39, M40: 40, M42: 42, M45: 45, M48: 48, M50: 50,
    M52: 52, M55: 55, M60: 60, M65: 65,
    '1/2': 12.7, '5/8': 15.875, '3/4': 19.05, '7/8': 22.225, '1"': 25.4, '1-1/8': 28.575, '1-1/4': 31.75, '1-1/2': 38.1,
};

/** FULLSIZE special: M12 is cut from a 13 mm bar for 4140 QT / 4340 QT (and 4140 plain, owner B-3). */
export const DIA_FULLSIZE_SPECIAL: Readonly<Record<string, number>> = { M12: 13 };

/** UNDERSIZE metric bar diameter (mm). M12 = 10.6 is gate OG-1 — kept. */
export const DIA_UNDERSIZE: Readonly<Record<string, number>> = {
    M6: 5.2, M8: 7, M10: 8.8, M12: 10.6, M14: 12.5, M16: 14.5, M20: 18, M22: 20, M25: 23,
};

/** UNDERSIZE inch bar diameter (mm). There is NO fallback to the fullsize inch table. */
export const DIA_UNDERSIZE_INCH: Readonly<Record<string, number>> = {
    '1/4': 5.3, '5/16': 6.8, '3/8': 8.2, '1/2': 10.9, '5/8': 14.2, '3/4': 17.1, '7/8': 20, '1"': 23,
};

/** Legacy WQA_INCH_DIA: the FULLSIZE inch reader (keys from wqaInchKey; whole inches without the mark). */
export const INCH_FULLSIZE_DIA: Readonly<Record<string, number>> = {
    '1/2': 12.7, '5/8': 15.875, '3/4': 19.05, '7/8': 22.225, '1': 25.4,
    '1-1/8': 28.575, '1-1/4': 31.75, '1-3/8': 34.925, '1-1/2': 38.1,
    '1/4': 6.35, '5/16': 7.9375, '3/8': 9.525,
};

export function lookup(table: Readonly<Record<string, number>>, key: string): number | undefined {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}
