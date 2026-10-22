import type { Material, ProductType } from '@/domain';

/* ── Quotation Builder state (Wave 2 · Session E) ───────────────────────────
   ONE item model for every entry mode (handoff §25 "both create the exact
   same canonical quotation item model"):
     quick   Quick Add — AI-assisted extraction from pasted text / image / PDF,
             reviewed before adding (the analyzer itself is Session I)
     manual  Manual Add — one item keyed by hand
     batch   Batch Add — common fields once, several similar rows
   They differ only in `entryMode` (provenance) and presentation.

   Field values are kept as the person typed them (strings) so nothing is
   rounded, defaulted or reinterpreted behind their back; the domain engine
   reads them (builder/compute.ts). A pricing field left `null` means "use the
   suggested value" — the suggestion follows the item identity, a typed value
   never gets overwritten (§24 "do not silently overwrite pricing"). */

export type EntryMode = 'quick' | 'manual' | 'batch';

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
    /**
     * Developed (cut) length. '' = AUTO: formula products use the calculated
     * value (shown in the field); a typed value = CUSTOM and drives weight /
     * price until "Use calculated". Manual / suggestion products must type it.
     */
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
    /** No Round (Advanced only, §17): the calculated price is not DNC-rounded. */
    noRound: boolean;
    /**
     * Override unit price — an explicit human override of the FINAL unit price
     * (Owner Smoke #2: "Override unit price"). null = no override. The
     * calculated unit price is always kept and shown beside it.
     */
    override: string | null;
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
    /**
     * Bar Ø (mm). '' = AUTO: the suggestion from Size · Material · Size Type is
     * used and follows them. Any typed value = CUSTOM: it outranks the table,
     * drives weight / geometry / price, and is never overwritten automatically
     * (nominal size ≠ actual bar: M12 UNDERSIZE may be Ø10.7, M24 may be Ø25).
     */
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
        // Every new item starts at Qty 1 (owner rule) — a default, not the customer's word.
        qty: '1',
        accessories: noAccessoriesDraft(),
        pricing: { costRate: null, addCost: null, markup: null, noRound: false, override: null },
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

/**
 * The next item for "Add & another" (Owner Smoke #2 Loop #2): keeps the
 * common context of the item just added — product, material, treatment,
 * property class, size type, finish, plate type and typed pricing defaults
 * (cost rate / additional cost / markup) — and resets everything that changes
 * per item: size, Bar Ø custom, dimensions, developed-length custom, Qty → 1,
 * override, No Round, accessories (conservatively: none) and weld.
 */
export function nextItemFrom(prev: DraftItem): DraftItem {
    const fresh = emptyItem(prev.product, prev.entryMode);
    return {
        ...fresh,
        productName: prev.productName,
        material: prev.material,
        treatment: prev.treatment,
        propertyClass: prev.propertyClass,
        sizeType: prev.sizeType,
        finish: prev.finish,
        plateType: prev.plateType,
        holeOption: prev.holeOption,
        pricing: { ...fresh.pricing, costRate: prev.pricing.costRate, addCost: prev.pricing.addCost, markup: prev.pricing.markup },
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
