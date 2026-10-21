import { formatSizeLabel } from './diameter';
import { type NumericInput, cleanNum, withMm } from './numbers';

/* Sag Rod thread length (handoff §21, owner B-5).

   A Sag Rod is threaded at both ends, so a single TL such as `100` canonicalises
   to `100/100` (legacy Quick Add already did this; the legacy manual form
   printed "TL 100mm"). An explicit `a/b` is kept as written. Blank stays blank. */
export function canonicalSagRodTL(raw: unknown): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const m = /^(\d+(?:\.\d+)?)\s*(?:mm)?$/i.exec(s);
    if (m) return `${m[1]}/${m[1]}`;
    return s;
}

export interface SagRodDimensionInput {
    size: unknown;
    diameter: NumericInput;
    sizeType: string | null | undefined;
    length: NumericInput;
    threadLen?: unknown;
}

/** The Sag Rod dimension line (legacy addSagRod label, with the TL canonicalised). */
export function sagRodDimension(i: SagRodDimensionInput): string {
    const tl = canonicalSagRodTL(i.threadLen);
    return formatSizeLabel(i.size, i.diameter, i.sizeType) + ' x L ' + cleanNum(i.length) + (tl ? ' x TL ' + withMm(tl) : '');
}
