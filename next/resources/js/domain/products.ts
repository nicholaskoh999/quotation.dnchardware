/* The product catalogue the engine knows about.

   Legacy item types (index.php ITEM_TYPES) plus the two products the owner
   made official in R0 FINAL: J Hook (§19) and Eye Bolt (§20). The identifiers
   are the legacy `itemType` strings so saved quotations read without mapping. */

export const PRODUCT_TYPES = [
    'sagrod',
    'stud',
    'anchorbolt',
    'ubolt',
    'squbolt',
    'lbolt',
    'lbolt45',
    'jbolt',
    'jhook',
    'eyebolt',
    'plate',
    'was',
    'others',
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Customer-facing product names (legacy ITEM_TYPES + §19 / §20). */
export const PRODUCT_NAMES: Record<ProductType, string> = {
    sagrod: 'SAG ROD',
    stud: 'STUD',
    anchorbolt: 'ANCHOR BOLT',
    ubolt: 'U BOLT',
    squbolt: 'SQ U BOLT',
    lbolt: 'L BOLT',
    lbolt45: 'L BOLT 45DEG',
    jbolt: 'J BOLT',
    jhook: 'J HOOK',
    eyebolt: 'EYE BOLT',
    plate: 'PLATE',
    was: 'WELDING ANCHOR SET',
    others: 'OTHERS / SPECIAL BOLT',
};

export function isProductType(v: unknown): v is ProductType {
    return typeof v === 'string' && (PRODUCT_TYPES as readonly string[]).includes(v);
}

/* Legacy hard rule: a STUD has no size type (index.php DC_NO_SIZE_TYPE_PRODUCTS). */
export const NO_SIZE_TYPE_PRODUCTS: readonly ProductType[] = ['stud'];

export function productHasSizeType(product: string): boolean {
    return !(NO_SIZE_TYPE_PRODUCTS as readonly string[]).includes(String(product || ''));
}

/** Legacy `dcSizeTypeFor`. */
export function sizeTypeFor(product: string, sizeType: string | null | undefined): string {
    return productHasSizeType(product) ? String(sizeType || '') : '';
}

export type SizeType = 'FULLSIZE' | 'UNDERSIZE' | '';
