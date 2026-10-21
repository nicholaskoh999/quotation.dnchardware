/* Shared contracts for the Wave 1 legacy READ layer (app/Legacy/**). These are
   the shapes the Laravel read controllers hand to Inertia pages — the page
   payload, which never carries raw stored JSON, the internal pricing recipe
   (cost rate / additional cost / markup) or the hidden Short Code alias. */

/** connected · no legacy DB configured on this host · configured but unreadable */
export type DataSourceState = 'connected' | 'not_configured' | 'unavailable';

export interface CompanyRow {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
    quotationCount: number;
    /** MAX(COALESCE(quote_date, DATE(created_at))) — api.php get_companies semantics */
    lastQuotedDate: string | null;
    lastQuotationCreatedAt: string | null;
    /** set when a search matched; 'alias' = the hidden legacy short code */
    matchedBy: 'name' | 'alias' | 'phone' | null;
}

export interface QuotationSummary {
    id: number;
    refNo: string;
    quoteDate: string | null;
    validUntil: string | null;
    preparedBy: string | null;
    customerName: string | null;
    customerPhone: string | null;
    companyId: number | null;
    companyName: string | null;
    /** customer_name, else the company's name (legacy reading) */
    customerDisplay: string | null;
    /** stored DECIMAL(12,2) as text — the authority, never recomputed */
    totalAmount: string | null;
    createdAt: string | null;
}

export interface Paginated<T> {
    rows: T[];
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
}

export interface MaterialReading {
    /** the stored legacy code, untouched (e.g. 4140_HARDEN_G10_9) */
    code: string;
    /** canonical material key (handoff §13), null when unrecognised */
    key: string | null;
    label: string;
    /** what the legacy screens printed (e.g. "4140 QT + HARDEN = G10.9") */
    legacyLabel: string;
    treatment: 'HARDEN' | null;
    propertyClass: string | null;
    hasFinish: boolean;
    recognised: boolean;
}

export type PricingModel = 'accessory-inclusive' | 'bolt-separate' | 'legacy';

export interface ItemPricing {
    model: PricingModel;
    /** what the customer pays per piece (per set for a Welding Anchor Set) */
    customerUnitPrice: number;
    /** null where the legacy record cannot separate it */
    boltUnitPrice: number | null;
    accessoryUnitPrice: number | null;
    ambiguous: boolean;
    total: number | null;
    totalSource: 'stored' | 'derived-legacy-rule' | 'missing';
    note: string | null;
}

export interface AccessoryPart {
    enabled: boolean;
    qty?: number | null;
    unitPrice: number | null;
    finish?: string | null;
    text?: string | null;
}

export interface ItemAccessories {
    nut: AccessoryPart | null;
    fw: AccessoryPart | null;
    custom: AccessoryPart | null;
    summary: string;
}

export interface ReadableItem {
    position: number;
    state: 'ok';
    itemUid: string | null;
    fieldsSource: 'stored' | 'legacy-description' | 'partial';
    itemType: string | null;
    productType: string | null;
    productKey: string | null;
    description: string | null;
    displayDescription: string;
    material: MaterialReading | null;
    sizeType: string | null;
    finish: string | null;
    finishLabel: string | null;
    sizeLabel: string;
    cleanSize: string | null;
    sizeSystem: 'metric' | 'imperial' | 'unknown';
    dimensionPreview: string | null;
    qty: number | null;
    unitSuffix: '' | '/set';
    pricing: ItemPricing;
    weight: number | null;
    accessories: ItemAccessories | null;
}

export interface UnreadableItem {
    position: number;
    state: 'unreadable';
    reason: string;
}

export type QuotationItem = ReadableItem | UnreadableItem;

export interface QuotationDetail extends QuotationSummary {
    previousRefNo: string | null;
    remarks: string | null;
    /** never stored server-side by the legacy app */
    issuer: null;
    issuerNote: string;
    itemsState: 'ok' | 'empty' | 'missing' | 'unreadable';
    itemCount: number;
    unreadableItemCount: number;
    items: QuotationItem[];
}

export interface RevisionEntry {
    revisionNo: number;
    event: string;
    createdAt: string | null;
    actor: { userId: number | null; username: string | null; displayName: string | null };
    schemaVersion: number;
}

export interface RevisionHistory {
    state: 'ok' | 'empty' | DataSourceState;
    entries: RevisionEntry[];
}

export interface CompaniesIndexProps {
    source: DataSourceState;
    search: string;
    companies: CompanyRow[];
}

export interface CompanyShowProps {
    source: DataSourceState;
    companyId: number;
    company: CompanyRow | null;
    quotations: Paginated<QuotationSummary> | null;
}

export interface QuotationsIndexProps {
    source: DataSourceState;
    filters: { company: number | null; search: string; page: number };
    quotations: Paginated<QuotationSummary> | null;
}

export interface QuotationShowProps {
    source: DataSourceState;
    quotationId: number;
    quotation: QuotationDetail | null;
    revisions: RevisionHistory;
}
