import type { ProductType } from './products';

/* DNC rounding — faithful ports of index.php round05 / roundCustom10 /
   roundMoney2, including their floating-point behaviour. Do not "simplify":
   rounding.json pins the float edges (2.675, 1.0349, 3.0049, 7.7649 …). */

/** Rounds to 2 dp, then a last digit of 9 moves up and a last digit of 1 moves down
 *  (1.09 → 1.1, 1.11 → 1.1, 1.15 → 1.15). It is NOT "round to 5 sen". */
export function round05(v: number): number {
    const r = Math.round(v * 100) / 100;
    const cents = Math.round(r * 100) % 10;
    if (cents === 9) return Math.round((r + 0.01) * 10) / 10;
    if (cents === 1) return Math.floor(r * 10) / 10;
    return r;
}

/** Sen 0–3 round down, 4–9 round up to the next 10 sen (with legacy's +1e-7 nudge). */
export function roundCustom10(v: number): number {
    const cents = Math.round((v + 0.0000001) * 100);
    const last = cents % 10;
    const rounded = last <= 3 ? cents - last : cents + (10 - last);
    return rounded / 100;
}

/** Two decimals, the currency's own precision. Every stored money figure goes through this. */
export function roundMoney2(v: unknown): number {
    return Math.round((Number(v) || 0) * 100) / 100;
}

export type RoundingRule = 'round05' | 'roundCustom10' | 'money2';

/* Product → DNC standard rounding rule.

   round05:       Sag Rod, Stud, Anchor Bolt, Plate, WAS          (legacy)
   roundCustom10: U, SQ-U, L, L 45°, J Bolt                       (legacy)
   money2:        Others                                          (legacy: "no rounding rule")
   money2:        J Hook, Eye Bolt — OPEN GATE OG-B1. They are new official
                  products (§19 / §20) and the handoff names no rounding rule
                  for them. Choosing round05 or roundCustom10 would be a pricing
                  decision, so the engine applies no product-specific rule yet
                  (two decimals only) until the owner decides. */
export const ROUNDING_RULES: Record<ProductType, RoundingRule> = {
    sagrod: 'round05',
    stud: 'round05',
    anchorbolt: 'round05',
    plate: 'round05',
    was: 'round05',
    ubolt: 'roundCustom10',
    squbolt: 'roundCustom10',
    lbolt: 'roundCustom10',
    lbolt45: 'roundCustom10',
    jbolt: 'roundCustom10',
    jhook: 'money2',
    eyebolt: 'money2',
    others: 'money2',
};

export function roundingRuleFor(product: ProductType): RoundingRule {
    return ROUNDING_RULES[product];
}

export function applyRounding(rule: RoundingRule, v: number): number {
    if (rule === 'round05') return round05(v);
    if (rule === 'roundCustom10') return roundCustom10(v);
    return roundMoney2(v);
}

/** The product's DNC standard rounding applied to a raw unit price. */
export function roundForProduct(product: ProductType, v: number): number {
    return applyRounding(roundingRuleFor(product), v);
}
