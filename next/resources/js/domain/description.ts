import { accessoryWording, wasAccessoryWording } from './accessories';
import { formatSizeLabel } from './diameter';
import { customerMaterialWording, legacyMaterialLabel, parseMaterial } from './material';
import { type NumericInput, cleanNum, withMm } from './numbers';
import { itemFinalUnit } from './pricing';
import { PRODUCT_NAMES, type ProductType, isProductType } from './products';
import { sagRodDimension } from './sagrod';
import { sizeDisplay } from './size';

/* Customer-facing wording: item description, dimension line, WhatsApp text.

   Customer output is English, carries ONE inclusive unit price per item,
   names accessories as wording only (`cw 2nut & 1fw`), and NEVER exposes Cost
   Rate, Additional Cost or Markup (§26) — nothing here reads them.
   Hardened items use the §14 wording (`S45C STUD · HARDENED TO G8.8 (PL)`).
   WhatsApp: ONE builder produces the text used for preview, send and copy, so
   preview ≡ sent (§26, B-9). Insertion-order item numbers are preserved and
   rows group by material + finish title (§34 C-4, kept). */

/* ── Dimension lines for new items (legacy add* label formats) ──────────── */
export interface DimensionInput {
    product: ProductType;
    size?: unknown;
    diameter?: NumericInput;
    sizeType?: string | null;
    length?: NumericInput;
    l?: NumericInput;
    w?: NumericInput;
    h?: NumericInput;
    id?: NumericInput;
    ih?: NumericInput;
    oh?: NumericInput;
    s?: NumericInput;
    threadLen?: unknown;
    /** Eye Bolt optional weld / FW attribute (§20). */
    weld?: boolean;
    /** Plate. */
    plateType?: 'ms_plate' | 'triangle_plate';
    t?: NumericInput;
    holeOption?: 'none' | 'center' | 'corners' | 'custom';
    holeDiameter?: NumericInput;
    holes?: NumericInput;
    triL?: NumericInput;
    triH?: NumericInput;
    triCL?: NumericInput;
    triCH?: NumericInput;
    triT?: NumericInput;
    /** Others: the typed dimension text. */
    dimensionText?: string;
}

const str = (v: unknown): string => String(v ?? '');
/* Legacy tests the raw field text: any non-blank text counts (a typed "0" included). */
const present = (v: unknown): boolean => v !== undefined && v !== null && str(v) !== '';

export function buildDimension(i: DimensionInput): string {
    const tl = str(i.threadLen).trim();
    const tlPart = tl ? ' x TL ' + withMm(tl) : '';
    const label = (): string => formatSizeLabel(i.size, i.diameter, i.sizeType);
    switch (i.product) {
        case 'sagrod':
            return sagRodDimension({ size: i.size, diameter: i.diameter ?? '', sizeType: i.sizeType, length: i.length ?? i.l ?? '', threadLen: i.threadLen });
        case 'stud':
            return sizeDisplay(i.size) + ' x L ' + cleanNum(i.l ?? i.length) + 'mm';
        case 'anchorbolt':
            return label() + ' x L ' + cleanNum(i.l ?? i.length) + tlPart;
        case 'ubolt':
            return label() + (present(i.id) ? ' x ID ' + cleanNum(i.id) : '') + (present(i.ih) ? ' x IH ' + cleanNum(i.ih) : '') + tlPart;
        case 'squbolt':
            return label() + ' x OH ' + cleanNum(i.oh) + ' x W ' + cleanNum(i.w) + tlPart;
        case 'lbolt':
        case 'lbolt45':
            return label() + ' x L ' + cleanNum(i.l ?? i.length) + ' x W ' + cleanNum(i.w) + tlPart + (i.product === 'lbolt45' ? ' 45deg' : '');
        case 'jbolt':
            return label() + ' x H ' + cleanNum(i.h) + ' x ID ' + cleanNum(i.id) + ' x S ' + cleanNum(i.s) + tlPart;
        case 'jhook':
            // §19 fields: Size · Diameter · L · W · TL (no H / ID).
            return label() + ' x L ' + cleanNum(i.l ?? i.length) + ' x W ' + cleanNum(i.w) + tlPart;
        case 'eyebolt':
            // §20 fields: Size · Diameter · L · ID · TL · optional S · optional Weld/FW.
            return (
                label() + ' x L ' + cleanNum(i.l ?? i.length) + ' x ID ' + cleanNum(i.id) +
                (present(i.s) ? ' x S ' + cleanNum(i.s) : '') + tlPart + (i.weld ? ' FW' : '')
            );
        case 'plate':
            return plateDimension(i);
        case 'others':
            return str(i.dimensionText).trim();
        case 'was':
            throw new Error('buildDimension: a Welding Anchor Set dimension is built by the WAS form');
    }
}

/** Legacy `buildPlateSizeStr`. */
export function plateDimension(i: DimensionInput): string {
    if ((i.plateType ?? 'ms_plate') === 'ms_plate') {
        let hole = '';
        if (i.holeOption === 'center') hole = ` x Ø${str(i.holeDiameter)}mm center hole`;
        else if (i.holeOption === 'corners') hole = ` x 4-Ø${str(i.holeDiameter)}mm holes`;
        else if (i.holeOption === 'custom') hole = ` x ${str(i.holes)}-Ø${str(i.holeDiameter)}mm holes`;
        return `L ${str(i.l)} x W ${str(i.w)} x T ${str(i.t)}mm${hole}`;
    }
    const cl = Number.parseFloat(str(i.triCL));
    const ch = Number.parseFloat(str(i.triCH));
    const cut = cl || ch ? `${cl ? ' x CL ' + str(i.triCL) : ''}${ch ? ' x CH ' + str(i.triCH) : ''}` : '';
    return `L ${str(i.triL)} x H ${str(i.triH)}${cut} x T ${str(i.triT)}mm`;
}

/** Legacy `buildDesc` (the stored item.desc). Hardened wording is applied at output time, not stored. */
export function buildItemDesc(product: ProductType, material: unknown, sizeType?: string | null, productName?: string): string {
    const mat = legacyMaterialLabel(material);
    if (product === 'others') return [mat, str(sizeType), str(productName).trim()].filter(Boolean).join(' ');
    if (product === 'stud') return mat + ' ' + PRODUCT_NAMES.stud;
    return mat + ' ' + str(sizeType) + ' ' + PRODUCT_NAMES[product];
}


/* ── Saved items → customer output ──────────────────────────────────────── */
export interface CustomDimension {
    label?: unknown;
    value?: unknown;
}

/** The saved item shape customer output reads (legacy quotation item JSON). */
export interface OutputItem {
    itemType?: string;
    productType?: string;
    material?: string;
    sizeType?: string;
    finish?: string;
    desc?: string;
    size?: string;
    qty?: unknown;
    finalUnitPrice?: unknown;
    boltUnitPrice?: unknown;
    accessoryUnitPrice?: unknown;
    lineUnitPrice?: unknown;
    totalAmount?: unknown;
    pricingModel?: string | null;
    weight?: unknown;
    accessories?: unknown;
    customDimensions?: CustomDimension[] | null;
    plateType?: string;
    dimensionPreview?: string;
    wasData?: { abLine?: string; compLines?: string } | null;
    formData?: Record<string, unknown> | null;
}

type Acc = Parameters<typeof accessoryWording>[0];

/** Legacy `displayItemDesc`: repairs very old descs that stored raw internal material values. */
export function displayItemDesc(item: OutputItem): string {
    const desc = str(item.desc);
    if (desc.includes('4140_HARDEN_G10_9')) return desc.replace(/4140_HARDEN_G10_9/g, '4140 QT + HARDEN = G10.9');
    if (desc.includes('S45C_HARDEN_G8_8')) return desc.replace(/S45C_HARDEN_G8_8/g, 'S45C + HARDEN = G8.8');
    const mat = str(item.material);
    if (mat === '4140_PLAIN' || mat === 'Y_BAR') return desc;
    return desc.replace(/\b4140\b(?!\s+QT)/g, '4140 QT').replace(/\b4340\b(?!\s+QT)/g, '4340 QT');
}

function productNameOf(item: OutputItem): string {
    const t = str(item.itemType);
    return (item.productType || (isProductType(t) ? PRODUCT_NAMES[t] : '') || '').trim();
}

function isHardened(item: OutputItem): boolean {
    const sm = parseMaterial(item.material);
    return !!sm && sm.treatment !== null;
}

/* §14 wording for a hardened item: "<MAT> [<SIZE TYPE>] <PRODUCT> · HARDENED TO G<PC> (<FINISH>)". */
function hardenedTitle(item: OutputItem): string {
    const t = str(item.itemType);
    const finish = str(item.finish).trim();
    if (t === 'was') return customerMaterialWording(item.material, 'WELDING ANCHOR SET', finish);
    const sizeType = t === 'stud' ? '' : str(item.sizeType).trim();
    return customerMaterialWording(item.material, [sizeType, productNameOf(item)].filter(Boolean).join(' '), finish);
}

/** Legacy `getWAGroupTitle`, with the §14 hardened wording (B-8). */
export function itemGroupTitle(item: OutputItem): string {
    const t = str(item.itemType);
    if (t === 'plate') {
        const plateType = item.plateType || str(item.formData?.plateType) || 'ms_plate';
        const desc = plateType === 'triangle_plate' ? 'TRIANGLE PLATE' : 'MS PLATE';
        const finish = str(item.finish).trim();
        return finish ? `${desc} (${finish})` : desc;
    }
    if (isHardened(item)) return hardenedTitle(item);
    if (t === 'was') {
        const finish = str(item.finish).trim();
        const title = legacyMaterialLabel(item.material || 'MS') + ' WELDING ANCHOR SET';
        return finish ? `${title} (${finish})` : title;
    }
    const material = legacyMaterialLabel(item.material).trim();
    const product = productNameOf(item);
    const sizeType = t === 'stud' ? '' : str(item.sizeType).trim();
    const finish = str(item.finish).trim();
    let title = [material, sizeType, product].filter(Boolean).join(' ');
    if (!title) title = str(item.desc || 'Item').replace(/\s+\([^)]*\)\s*$/, '').trim();
    return finish ? `${title} (${finish})` : title;
}

/** Legacy `getPrintItemDescription`, with the §14 hardened wording (B-8). */
export function itemDescription(item: OutputItem): string {
    if (isHardened(item)) return hardenedTitle(item);
    const t = str(item.itemType);
    const description = (displayItemDesc(item) || item.productType || (isProductType(t) ? PRODUCT_NAMES[t] : '') || 'Item').trim();
    const finish = str(item.finish).trim();
    return finish && !description.endsWith(`(${finish})`) ? `${description} (${finish})` : description;
}

function customDimsText(list: CustomDimension[] | null | undefined): string {
    if (!Array.isArray(list)) return '';
    return list
        .map((e) => ({ label: str(e?.label).trim(), value: str(e?.value).trim() }))
        .filter((e) => e.label !== '' || e.value !== '')
        .map((e) => [e.label, e.value].filter(Boolean).join(' '))
        .join(' · ');
}

/** "Custom: H2 530 · A 120" (legacy dcCustomDimsPrintLine / dcCustomDimsLine, English). */
export function customDimensionsLine(item: OutputItem): string {
    const t = customDimsText(item.customDimensions);
    return t ? 'Custom: ' + t : '';
}

/** Legacy `wasDisplayData`. */
export function wasDisplay(item: OutputItem): { abLine: string; compLines: string; size: string } {
    const raw = str(item.size);
    const rawLines = raw.split('\n');
    const abLine = str(item.wasData?.abLine || item.dimensionPreview || rawLines[0] || '').trim();
    let compLines = str(item.wasData?.compLines || rawLines.slice(1).join('\n') || '');
    const fd = item.formData || {};
    const tpQty = fd.trianglePlateQtyPerSet ?? fd.tpQty;
    if (Number(tpQty) === 0) compLines = compLines.split('\n').filter((line) => !line.includes('Triangle Plate:')).join('\n');
    return { abLine, compLines, size: [abLine, compLines].filter(Boolean).join('\n') };
}

/** The customer accessory wording for an item ('' when none). */
export function itemAccessoryWording(item: OutputItem): string {
    const acc = (item.accessories ?? null) as Acc;
    return str(item.itemType) === 'was' ? wasAccessoryWording(acc) : (accessoryWording(acc) ?? '');
}

/** Legacy `getPrintItemDimension`: size, custom dimensions, accessory wording — one per line. */
export function itemDimension(item: OutputItem): string {
    const size = str(item.itemType) === 'was' ? wasDisplay(item).size : str(item.size);
    return [size, customDimensionsLine(item), itemAccessoryWording(item)].filter(Boolean).join('\n');
}

/** The one inclusive unit price the customer sees. */
export function customerUnitPrice(item: OutputItem): number {
    return str(item.itemType) === 'was' ? Number(item.finalUnitPrice) || 0 : itemFinalUnit(item);
}

export interface PrintLine {
    no: number;
    description: string;
    dimension: string;
    qty: number;
    unitPrice: number;
    amount: number;
}

/** Print rows in insertion order (item N is item N everywhere). */
export function printLines(items: readonly OutputItem[]): PrintLine[] {
    return items.map((item, i) => ({
        no: i + 1,
        description: itemDescription(item),
        dimension: itemDimension(item),
        qty: Number.parseInt(str(item.qty), 10) || 0,
        unitPrice: customerUnitPrice(item),
        amount: Number(item.totalAmount) || 0,
    }));
}

/* ── WhatsApp ───────────────────────────────────────────────────────────── */
export type WhatsAppGrouping = 'consecutive' | 'byTitle';

export interface WhatsAppRow {
    /** The quotation item's own number (insertion order). Never merged with another item. */
    no: number;
    size: string;
    price: string;
    cw: string;
    custom: string;
    unitWeight: string;
    isWas: boolean;
    wasComp: string;
}

export interface WhatsAppGroup {
    title: string;
    rows: WhatsAppRow[];
}

export interface WhatsAppOptions {
    /** 'consecutive' (default) = legacy SENT behaviour: a new heading whenever the title changes.
     *  'byTitle' = one heading per material + finish title across the quotation. Rows are never merged. */
    grouping?: WhatsAppGrouping;
    /** Copy + Weight: the stored per-piece weight ("0.693kg/pc"). */
    includeUnitWeight?: boolean;
}

function fmtRM(v: number): string {
    return 'RM' + (Number.parseFloat(String(v)) || 0).toFixed(2);
}

/** Group items for WhatsApp, preserving insertion order and each item's own number. */
export function groupWhatsAppItems(items: readonly OutputItem[], opts: WhatsAppOptions = {}): WhatsAppGroup[] {
    const grouping = opts.grouping ?? 'consecutive';
    const groups: WhatsAppGroup[] = [];
    const byTitle = new Map<string, WhatsAppGroup>();
    items.forEach((item, index) => {
        const title = itemGroupTitle(item);
        let group: WhatsAppGroup | undefined;
        if (grouping === 'byTitle') group = byTitle.get(title);
        else {
            const last = groups[groups.length - 1];
            group = last && last.title === title ? last : undefined;
        }
        if (!group) {
            group = { title, rows: [] };
            groups.push(group);
            if (!byTitle.has(title)) byTitle.set(title, group);
        }
        const isWas = str(item.itemType) === 'was';
        const wd = isWas ? wasDisplay(item) : null;
        const weight = Number.parseFloat(str(item.weight));
        group.rows.push({
            no: index + 1,
            size: isWas && wd ? wd.abLine : str(item.size).trim(),
            price: fmtRM(customerUnitPrice(item)),
            cw: itemAccessoryWording(item),
            custom: customDimensionsLine(item),
            unitWeight: opts.includeUnitWeight && !isWas && weight > 0 ? weight.toFixed(3) + 'kg/pc' : '',
            isWas,
            wasComp: wd ? wd.compLines : '',
        });
    });
    return groups;
}

/** The items block of the WhatsApp message (legacy buildWAItemsText, never merging rows). */
export function buildWhatsAppItemsText(items: readonly OutputItem[], opts: WhatsAppOptions = {}, emptyText = '-'): string {
    if (!items.length) return emptyText;
    return groupWhatsAppItems(items, opts)
        .map((group) => {
            const cwSet = new Set(group.rows.map((r) => r.cw).filter(Boolean));
            const allSameCw = group.rows.length > 0 && group.rows.every((r) => r.cw) && cwSet.size === 1;
            const rows = group.rows
                .map((row) => {
                    const no = String(row.no);
                    if (row.isWas) {
                        const compPart = row.wasComp ? '\n' + row.wasComp : '';
                        const cwPart = row.cw ? '\n   ' + row.cw : '';
                        return `${no}) ${row.size}${compPart}${cwPart}\n   - ${row.price}/set`;
                    }
                    const line = `${no}) ${row.size}${row.unitWeight ? ' - ' + row.unitWeight : ''} - ${row.price}`;
                    const customPart = row.custom ? '\n   ' + row.custom : '';
                    const cwPart = !allSameCw && row.cw ? '\n' + row.cw : '';
                    return line + customPart + cwPart;
                })
                .join('\n');
            const hasWas = group.rows.some((r) => r.isWas);
            const cwSuffix = allSameCw && !hasWas ? '\n' + [...cwSet][0] : '';
            return `${group.title}\n${rows}${cwSuffix}`;
        })
        .join('\n\n');
}

export const WHATSAPP_DEFAULT_TEMPLATE =
    'Hi {customer},\nQuotation {quotationNo} is ready.\nDate: {date}\n\nItems:\n{items}\n\nTotal: RM{total}\n\nPrepared by: {preparedBy}\nThank you.';

export interface QuotationMeta {
    customer?: string | null;
    refno?: string | null;
    date?: string | null;
    prepby?: string | null;
}

export function grandTotal(items: readonly OutputItem[]): number {
    return items.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
}

/** The complete WhatsApp message (legacy buildQuoteText). */
export function buildWhatsAppMessage(
    items: readonly OutputItem[],
    meta: QuotationMeta,
    opts: WhatsAppOptions & { template?: string } = {},
): string {
    const tpl = opts.template ?? WHATSAPP_DEFAULT_TEMPLATE;
    const itemLines = buildWhatsAppItemsText(items, opts, '-');
    return tpl
        .replace(/{customer}/g, () => meta.customer || '-')
        .replace(/{quotationNo}/g, () => meta.refno || '-')
        .replace(/{no}/g, () => meta.refno || '-')
        .replace(/{date}/g, () => meta.date || '-')
        .replace(/{total}/g, () => grandTotal(items).toFixed(2))
        .replace(/{items}/g, () => itemLines || '-')
        .replace(/{preparedBy}/g, () => meta.prepby || '-');
}

export interface WhatsAppOutput {
    /** What the preview shows. */
    preview: string;
    /** What is sent / copied. Always the same string as `preview` (§26). */
    sent: string;
}

/** One build, used for preview AND send/copy, so they cannot differ (§26, B-9). */
export function whatsappOutput(items: readonly OutputItem[], meta: QuotationMeta, opts: WhatsAppOptions & { template?: string } = {}): WhatsAppOutput {
    const text = buildWhatsAppMessage(items, meta, opts);
    return { preview: text, sent: text };
}

