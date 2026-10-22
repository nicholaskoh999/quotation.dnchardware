import type { Material, PriceMode, ProductType } from '@/domain';

/* ── Quotation Builder state (Wave 2 · Session E) ───────────────────────────
   ONE item model for every entry mode (handoff §25 "both create the exact
   same canonical quotation item model"). Quick Add and Manual Add differ only
   in `entryMode` (provenance) and in how fields are presented.

   Field values are kept as the person typed them (strings) so nothing is
   rounded, defaulted or reinterpreted behind their back; the domain engine
   reads them (builder/compute.ts). A pricing field left `null` means "use the
   suggested value" — the suggestion follows the item identity, a typed value
   never gets overwritten (§24 "do not silently overwrite pricing"). */

export type EntryMode = 'quick' | 'manual';

/** Every dimension input the supported products use (legacy add* field names). */
export interface ItemDimensions {
    /** Sag Rod straight length. */
    length: string;
    /** L (Stud, Anchor Bolt, L Bolt, J Hook, Eye Bolt, Plate). */
    l: string;
    w: string;
    h: string;
    id: string;
    ih: string;
    oh: string;
    s: string;
    /** Thread length (TL); Sag Rod canonicalises `100` → `100/100` (§21). */
    threadLen: string;
    /** A typed developed (cut) length — manual products, or an override. */
    developedLength: string;
    /** Plate. */
    t: string;
    triL: string;
    triH: string;
    triCL: string;
    triCH: string;
    triT: string;
    holeDiameter: string;
    holes: string;
    /** Others: the typed dimension text and an optional typed unit weight. */
    dimensionText: string;
    unitWeight: string;
}

export interface CountedAccessoryDraft {
    /** "Qty per item". Blank ⇒ the default (Nut 2 / FW 1); an explicit 0 stays 0 (§18). */
    qty: string;
    finish: string;
    unitPrice: string;
}

export interface CustomAccessoryDraft {
    text: string;
    unitPrice: string;
}

/** An accessory is selected by being present (null = not selected). */
export interface AccessoriesDraft {
    nut: CountedAccessoryDraft | null;
    fw: CountedAccessoryDraft | null;
    custom: CustomAccessoryDraft | null;
}

export interface ItemPricingDraft {
    /** null ⇒ the suggested value (built-in default price / TL surcharge). */
    costRate: string | null;
    addCost: string | null;
    markup: string | null;
    /** Calculated (normal) · Manual override (explicit action) · No Round (Advanced only). §17. */
    mode: PriceMode;
    /** The customer's final unit price, read only in manual mode. */
    manualUnitPrice: string;
}

export interface DraftItem {
    /** Stable identity for the editing session (never shown; the item number is the position). */
    uid: string;
    entryMode: EntryMode;
    product: ProductType;
    /** Others: the typed product name. */
    productName: string;
    material: Material;
    treatment: 'HARDEN' | null;
    /** 8.8 · 10.9 · 12.9 · or custom text. Required with HARDEN. */
    propertyClass: string;
    sizeType: '' | 'FULLSIZE' | 'UNDERSIZE';
    /** PL · ZP · HDG; '' for N/A (stainless). */
    finish: string;
    /** As typed; the engine interprets it (§12). */
    size: string;
    /** A typed bar diameter that outranks the built-in table (unknown sizes, special bar). */
    diameterOverride: string;
    dims: ItemDimensions;
    /** Plate only. */
    plateType: 'ms_plate' | 'triangle_plate';
    holeOption: 'none' | 'center' | 'corners' | 'custom';
    /** Eye Bolt optional Weld / FW attribute (§20). */
    weld: boolean;
    qty: string;
    accessories: AccessoriesDraft;
    pricing: ItemPricingDraft;
}

export interface CustomerDraft {
    /** A directory company, or null for a typed (not yet registered) customer. */
    companyId: number | null;
    name: string;
    contact: string;
    phone: string;
    address: string;
}

export interface DraftQuotation {
    customer: CustomerDraft;
    /** ISO yyyy-mm-dd (displayed day-first). */
    quoteDate: string;
    /** ISO yyyy-mm-dd or ''. */
    validUntil: string;
    remarks: string;
    items: DraftItem[];
}

export function emptyDimensions(): ItemDimensions {
    return {
        length: '', l: '', w: '', h: '', id: '', ih: '', oh: '', s: '', threadLen: '', developedLength: '',
        t: '', triL: '', triH: '', triCL: '', triCH: '', triT: '', holeDiameter: '', holes: '',
        dimensionText: '', unitWeight: '',
    };
}

export function noAccessoriesDraft(): AccessoriesDraft {
    return { nut: null, fw: null, custom: null };
}

let uidCounter = 0;
export function newUid(): string {
    uidCounter += 1;
    const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    return `itm_${Date.now().toString(36)}_${uidCounter}_${rand}`;
}

export function emptyItem(product: ProductType = 'sagrod', entryMode: EntryMode = 'manual'): DraftItem {
    return {
        uid: newUid(),
        entryMode,
        product,
        productName: '',
        material: 'MS',
        treatment: null,
        propertyClass: '',
        sizeType: product === 'stud' || product === 'plate' || product === 'others' ? '' : 'FULLSIZE',
        finish: 'PL',
        size: '',
        diameterOverride: '',
        dims: emptyDimensions(),
        plateType: 'ms_plate',
        holeOption: 'none',
        weld: false,
        qty: '',
        accessories: noAccessoriesDraft(),
        pricing: { costRate: null, addCost: null, markup: null, mode: 'calculated', manualUnitPrice: '' },
    };
}

export function emptyQuotation(todayIso: string): DraftQuotation {
    return {
        customer: { companyId: null, name: '', contact: '', phone: '', address: '' },
        quoteDate: todayIso,
        validUntil: '',
        remarks: '',
        items: [],
    };
}

/** A copy of an item with a fresh identity (Duplicate). */
export function duplicateItem(item: DraftItem): DraftItem {
    return {
        ...structuredCloneSafe(item),
        uid: newUid(),
    };
}

export function structuredCloneSafe<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Has the person entered anything worth protecting? (autosave / leave warning)
 * The default date alone is not meaningful.
 */
export function isMeaningful(q: DraftQuotation): boolean {
    const c = q.customer;
    return (
        q.items.length > 0 ||
        c.companyId !== null ||
        [c.name, c.contact, c.phone, c.address, q.remarks, q.validUntil].some((v) => v.trim() !== '')
    );
}
