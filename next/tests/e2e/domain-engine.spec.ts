import { expect, test } from '@playwright/test';
import { builtInDiameter, findDefaultPrice, interpretSize, priceItem, whatsappOutput } from '../../resources/js/domain';

/* The Wave 1 domain engine has no screen yet (the builder is Wave 2), so this
   spec drives the engine directly from the Playwright runner: it proves the
   framework-free modules load outside Vitest exactly as the app will import
   them, and pins the owner-approved B rules end to end. */
test.describe('domain engine (framework-free)', () => {
    test('owner rules B-2 / B-3 / §12 / §26 hold through the public API', () => {
        expect(findDefaultPrice('sagrod', 'MS', 'FULLSIZE', 'M12', 'HDG')).toEqual({ costRate: 6.5, addCost: 1.6, markup: 0, source: 'system' });
        expect(builtInDiameter('sagrod', '4140_PLAIN', 'FULLSIZE', 'M12')).toBe(13);
        expect(builtInDiameter('sagrod', 'MS', 'UNDERSIZE', 'M12')).toBe(10.6); // OG-1: legacy kept
        expect(interpretSize('72')).toMatchObject({ normalised: '72', needsReview: true });
        const p = priceItem({ product: 'sagrod', weight: 0.692744344, costRate: '2.80', addCost: '0.60', markup: '0', accessories: { nut: { qty: '0', price: '0.5' } }, qty: 10 });
        expect(p).toMatchObject({ finalUnitPrice: 2.54, totalAmount: 25.4, priceSource: 'calculated' });
        const wa = whatsappOutput([{ itemType: 'stud', productType: 'STUD', material: 'S45C_HARDEN_G8_8', finish: 'PL', size: 'M16 x L 300mm', finalUnitPrice: 4.1, pricingModel: 'accessory-inclusive', totalAmount: 82, qty: 20 }], { customer: 'X', refno: 'Q-2026-0001' });
        expect(wa.preview).toBe(wa.sent);
        expect(wa.sent).toContain('S45C STUD · HARDENED TO G8.8 (PL)\n1) M16 x L 300mm - RM4.10');
    });
});
