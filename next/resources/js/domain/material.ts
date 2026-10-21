/* Material model (handoff §13 / §14 / §34 C-1, C-7).

   Canonical materials: MS · 4140 QT · 4140 (plain, non-QT) · 4340 QT · S45C ·
   SS304 · SS316 · Y BAR. Finish is separate (PL / ZP / HDG / N/A). Hardened
   variants are Material · Treatment · Property Class, not combined materials;
   the legacy combined codes stay readable. */

export const MATERIALS = ['MS', '4140 QT', '4140', '4340 QT', 'S45C', 'SS304', 'SS316', 'Y BAR'] as const;
export type Material = (typeof MATERIALS)[number];

export const FINISHES = ['PL', 'ZP', 'HDG', ''] as const;
/** '' is N/A (stainless has no finish). */
export type Finish = (typeof FINISHES)[number];

export type Treatment = 'HARDEN';
export const TREATMENTS: readonly Treatment[] = ['HARDEN'];

/** Common Property Class options. 12.9 is owner-approved new (§13, §30) — never historical evidence. */
export const PROPERTY_CLASS_OPTIONS = ['8.8', '10.9', '12.9'] as const;
/** A listed class, or any custom/other class text. */
export type PropertyClass = string;

export interface StructuredMaterial {
    material: Material;
    treatment: Treatment | null;
    propertyClass: PropertyClass | null;
}

/** Legacy stored material codes (index.php <select> values). */
export const LEGACY_MATERIAL_CODES = [
    'MS', 'S45C', 'S45C_HARDEN_G8_8', '4140', '4140_HARDEN_G10_9', '4140_PLAIN', '4340', 'SS304', 'SS316', 'Y_BAR',
] as const;
export type LegacyMaterialCode = (typeof LEGACY_MATERIAL_CODES)[number];

const LEGACY_TO_STRUCTURED: Record<LegacyMaterialCode, StructuredMaterial> = {
    MS: { material: 'MS', treatment: null, propertyClass: null },
    S45C: { material: 'S45C', treatment: null, propertyClass: null },
    S45C_HARDEN_G8_8: { material: 'S45C', treatment: 'HARDEN', propertyClass: '8.8' },
    '4140': { material: '4140 QT', treatment: null, propertyClass: null },
    '4140_HARDEN_G10_9': { material: '4140 QT', treatment: 'HARDEN', propertyClass: '10.9' },
    '4140_PLAIN': { material: '4140', treatment: null, propertyClass: null },
    '4340': { material: '4340 QT', treatment: null, propertyClass: null },
    SS304: { material: 'SS304', treatment: null, propertyClass: null },
    SS316: { material: 'SS316', treatment: null, propertyClass: null },
    Y_BAR: { material: 'Y BAR', treatment: null, propertyClass: null },
};

/** Base material (no treatment) → legacy stored code. */
const MATERIAL_TO_LEGACY: Record<Material, LegacyMaterialCode> = {
    MS: 'MS',
    '4140 QT': '4140',
    '4140': '4140_PLAIN',
    '4340 QT': '4340',
    S45C: 'S45C',
    SS304: 'SS304',
    SS316: 'SS316',
    'Y BAR': 'Y_BAR',
};

/* Canonical-label spellings accepted on input (case/space-insensitive). */
const LABEL_ALIASES: Record<string, Material> = {
    MS: 'MS',
    '4140QT': '4140 QT',
    '4140': '4140 QT', // a stored/typed bare 4140 reads as 4140 QT (§13 canonical 4140 rule)
    '4140PLAIN': '4140',
    '4340QT': '4340 QT',
    '4340': '4340 QT',
    S45C: 'S45C',
    SS304: 'SS304',
    SS316: 'SS316',
    YBAR: 'Y BAR',
};

function isLegacyCode(v: string): v is LegacyMaterialCode {
    return (LEGACY_MATERIAL_CODES as readonly string[]).includes(v);
}

function baseFromText(text: string): Material | null {
    const compact = text.toUpperCase().replace(/[\s_]+/g, '');
    return Object.prototype.hasOwnProperty.call(LABEL_ALIASES, compact) ? (LABEL_ALIASES[compact] ?? null) : null;
}

/**
 * Read a material from a legacy stored code ('4140', '4140_PLAIN', 'S45C_HARDEN_G8_8' …),
 * a legacy label ('4140 QT + HARDEN = G10.9'), or structured text ('4140 QT + HARDEN + 12.9').
 * Returns null for something that is not a material we know.
 */
export function parseMaterial(raw: unknown): StructuredMaterial | null {
    if (raw && typeof raw === 'object') {
        const o = raw as Partial<StructuredMaterial>;
        if (o.material && (MATERIALS as readonly string[]).includes(o.material)) {
            return { material: o.material, treatment: o.treatment ?? null, propertyClass: o.propertyClass ?? null };
        }
        return null;
    }
    const text = String(raw ?? '').trim();
    if (!text) return null;
    if (isLegacyCode(text)) return { ...LEGACY_TO_STRUCTURED[text] };
    // Legacy combined code pattern: <BASE>_HARDEN_G<a>_<b>
    let m = /^(.+?)_HARDEN_G(\d+)_(\d+)$/i.exec(text);
    if (m) {
        const base = baseFromText(String(m[1]));
        if (base) return { material: base, treatment: 'HARDEN', propertyClass: `${m[2]}.${m[3]}` };
        return null;
    }
    // Label / structured text: "<BASE> + HARDEN = G10.9", "<BASE> + HARDEN + 12.9", "<BASE> HARDEN G12.9"
    m = /^(.+?)\s*\+?\s*HARDEN(?:ED)?\s*(?:TO)?\s*[+=]?\s*(?:G\s*)?(\d+(?:\.\d+)?)?\s*$/i.exec(text);
    if (m) {
        const base = baseFromText(String(m[1]));
        if (base) return { material: base, treatment: 'HARDEN', propertyClass: m[2] ? String(m[2]) : null };
        return null;
    }
    const base = baseFromText(text);
    return base ? { material: base, treatment: null, propertyClass: null } : null;
}

/** Structured → legacy stored code, where one exists. 12.9 and other new combinations have none → null. */
export function toLegacyMaterialCode(sm: StructuredMaterial): LegacyMaterialCode | null {
    if (!sm.treatment) return MATERIAL_TO_LEGACY[sm.material];
    for (const code of LEGACY_MATERIAL_CODES) {
        const c = LEGACY_TO_STRUCTURED[code];
        if (c.material === sm.material && c.treatment === sm.treatment && c.propertyClass === sm.propertyClass) return code;
    }
    return null;
}

/** Materials quoted without a finish (legacy DC_NO_FINISH_MATERIALS). */
export const NO_FINISH_MATERIALS: readonly Material[] = ['SS304', 'SS316'];

export function materialHasFinish(material: unknown): boolean {
    const sm = parseMaterial(material);
    const name = sm ? sm.material : String(material ?? '');
    return !(NO_FINISH_MATERIALS as readonly string[]).includes(name);
}

/** Legacy `dcFinishFor`: stainless ⇒ N/A (''). */
export function finishFor(material: unknown, finish: unknown): Finish | string {
    return materialHasFinish(material) ? String(finish ?? '') : '';
}

/** Legacy `materialLabel` (for reading legacy records; customer output uses the structured wording). */
export function legacyMaterialLabel(material: unknown): string {
    const labels: Record<string, string> = {
        S45C_HARDEN_G8_8: 'S45C + HARDEN = G8.8',
        '4140': '4140 QT',
        '4340': '4340 QT',
        '4140_HARDEN_G10_9': '4140 QT + HARDEN = G10.9',
        '4140_PLAIN': '4140',
        Y_BAR: 'Y BAR',
    };
    const key = String(material ?? '');
    return (Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : undefined) ?? key;
}

/** Legacy `isMaterialOptionText`: is this text one of the material option labels? */
export function isMaterialOptionText(text: unknown): boolean {
    const value = String(text ?? '').trim().toUpperCase();
    if (!value) return false;
    const labels = ['MS', 'S45C', 'S45C + HARDEN = G8.8', '4140 QT', '4140 QT + HARDEN = G10.9', '4140', '4340 QT', 'SS304', 'SS316', 'Y BAR'];
    return labels.some((l) => l.toUpperCase() === value);
}

/** Customer-facing material name: the canonical base material ('4140 QT', 'Y BAR'). */
export function materialName(material: unknown): string {
    const sm = parseMaterial(material);
    return sm ? sm.material : legacyMaterialLabel(material);
}

/** "HARDENED TO G10.9" (§14); null when there is no treatment. */
export function treatmentWording(sm: StructuredMaterial | null): string | null {
    if (!sm || sm.treatment !== 'HARDEN') return null;
    return sm.propertyClass ? `HARDENED TO G${sm.propertyClass}` : 'HARDENED';
}

/**
 * Customer-facing hardened wording (§14): `S45C STUD · HARDENED TO G8.8 (PL)`.
 * `productPhrase` is what follows the material (e.g. 'STUD', 'FULLSIZE L BOLT').
 * A non-hardened material reads `MS STUD (PL)`. Finish N/A ('') prints no brackets.
 */
export function customerMaterialWording(material: unknown, productPhrase: string, finish?: string | null): string {
    const sm = parseMaterial(material);
    const head = [sm ? sm.material : legacyMaterialLabel(material), productPhrase.trim()].filter(Boolean).join(' ');
    const t = treatmentWording(sm);
    const body = t ? `${head} · ${t}` : head;
    const f = String(finish ?? '').trim();
    return f ? `${body} (${f})` : body;
}

/* ── §34 C-1: the legacy bare-grade rule, kept as the oracle ───────────────
   A bare strength grade with no base material: 8.8 / G8.8 / HT8.8 / GRADE 8.8
   ⇒ 4140 QT; 10.9 / G10.9 / HT10.9 ⇒ 4340 QT. A stainless base material
   outranks a grade written beside it. Changing bare 10.9 to anything else is
   an owner decision (C-1), so this helper does not. */
export function legacyBareGradeMaterial(grade: unknown, baseMaterial?: unknown): StructuredMaterial | null {
    const base = baseMaterial === undefined ? null : parseMaterial(baseMaterial);
    if (base && (NO_FINISH_MATERIALS as readonly string[]).includes(base.material)) return base;
    const g = String(grade ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
    const m = /^(?:(?:GRADE|GR\.?|G|CLASS|CL\.?|H\.?\s*T\.?|HIGH TENSILE(?: GRADE)?)[\s-]*)?(8\.?8|10\.?9)$/.exec(g);
    if (!m) return null;
    const cls = String(m[1]).replace(/^(\d+)\.?(\d)$/, '$1.$2');
    return cls === '8.8'
        ? { material: '4140 QT', treatment: null, propertyClass: null }
        : { material: '4340 QT', treatment: null, propertyClass: null };
}
