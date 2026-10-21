import { describe, expect, it } from 'vitest';
import { buildDimension, buildItemDesc, itemDescription, itemDimension, itemGroupTitle } from './description';

describe('description: dimension lines (legacy formats + §19 / §20)', () => {
    it('legacy product formats', () => {
        expect(buildDimension({ product: 'sagrod', size: 'M12', diameter: 10.6, sizeType: 'UNDERSIZE', length: 1000, threadLen: '100' })).toBe('M12 x L 1000 x TL 100/100mm');
        expect(buildDimension({ product: 'stud', size: '1/2', l: 300 })).toBe('1/2" x L 300mm');
        expect(buildDimension({ product: 'anchorbolt', size: 'M20', diameter: 20, sizeType: 'FULLSIZE', l: 600, threadLen: '150' })).toBe('M20 x L 600 x TL 150mm');
        expect(buildDimension({ product: 'ubolt', size: 'M12', diameter: 12, sizeType: 'FULLSIZE', id: '64', ih: '85', threadLen: '50' })).toBe('M12 x ID 64 x IH 85 x TL 50mm');
        expect(buildDimension({ product: 'squbolt', size: 'M12', diameter: 12, sizeType: 'FULLSIZE', oh: 100, w: 80 })).toBe('M12 x OH 100 x W 80');
        expect(buildDimension({ product: 'lbolt45', size: 'M20', diameter: 20, sizeType: 'FULLSIZE', l: 1000, w: 100 })).toBe('M20 x L 1000 x W 100 45deg');
        expect(buildDimension({ product: 'jbolt', size: 'M12', diameter: 13, sizeType: 'FULLSIZE', h: 910, id: 60, s: 150 })).toBe('Ø13-M12 x H 910 x ID 60 x S 150');
        expect(buildDimension({ product: 'plate', l: 200, w: 200, t: 10, holeOption: 'corners', holeDiameter: 18 })).toBe('L 200 x W 200 x T 10mm x 4-Ø18mm holes');
        expect(buildDimension({ product: 'plate', plateType: 'triangle_plate', triL: 180, triH: 180, triCL: 20, triT: 8 })).toBe('L 180 x H 180 x CL 20 x T 8mm');
    });
    it('J Hook: Size · L · W · TL only; Eye Bolt: L · ID · optional S · TL · optional FW', () => {
        expect(buildDimension({ product: 'jhook', size: 'M12', diameter: 12, sizeType: 'FULLSIZE', l: 300, w: 80, threadLen: '75' })).toBe('M12 x L 300 x W 80 x TL 75mm');
        expect(buildDimension({ product: 'eyebolt', size: 'M16', diameter: 16, sizeType: 'FULLSIZE', l: 250, id: 40 })).toBe('M16 x L 250 x ID 40');
        expect(buildDimension({ product: 'eyebolt', size: 'M16', diameter: 16, sizeType: 'FULLSIZE', l: 250, id: 40, s: 60, threadLen: '50', weld: true })).toBe('M16 x L 250 x ID 40 x S 60 x TL 50mm FW');
    });
    it('stored desc and output titles', () => {
        expect(buildItemDesc('sagrod', '4140', 'FULLSIZE')).toBe('4140 QT FULLSIZE SAG ROD');
        expect(buildItemDesc('stud', 'Y_BAR')).toBe('Y BAR STUD');
        expect(buildItemDesc('others', '', '', 'SPECIAL')).toBe('SPECIAL');
        const eye = { itemType: 'eyebolt', productType: 'EYE BOLT', material: 'MS', sizeType: 'FULLSIZE', finish: 'HDG', desc: 'MS FULLSIZE EYE BOLT', size: 'M16 x L 250 x ID 40' };
        expect(itemGroupTitle(eye)).toBe('MS FULLSIZE EYE BOLT (HDG)');
        expect(itemDescription(eye)).toBe('MS FULLSIZE EYE BOLT (HDG)');
        const hardLBolt = { itemType: 'lbolt', productType: 'L BOLT', material: '4140_HARDEN_G10_9', sizeType: 'FULLSIZE', finish: 'HDG', desc: '4140 QT + HARDEN = G10.9 FULLSIZE L BOLT' };
        expect(itemDescription(hardLBolt)).toBe('4140 QT FULLSIZE L BOLT · HARDENED TO G10.9 (HDG)');
        expect(itemGroupTitle({ itemType: 'plate', plateType: 'triangle_plate', finish: '' })).toBe('TRIANGLE PLATE');
        expect(itemDescription({ itemType: 'sagrod', material: '4140', desc: '4140 FULLSIZE SAG ROD', finish: 'PL' })).toBe('4140 QT FULLSIZE SAG ROD (PL)');
    });
    it('dimension carries custom dimensions and accessory wording; a zero-qty accessory adds none', () => {
        const item = {
            itemType: 'sagrod', size: 'M20 x L 1000',
            customDimensions: [{ label: 'H2', value: '530' }, { label: '', value: '' }],
            accessories: { nut: { enabled: true, qty: 0, finish: '', unitPrice: 1 }, fw: { enabled: true, qty: 1, finish: '', unitPrice: 0.3 }, custom: { enabled: false, text: '', unitPrice: 0 } },
        };
        expect(itemDimension(item)).toBe('M20 x L 1000\nCustom: H2 530\ncw 1fw');
    });
    it('WAS dimension and title', () => {
        const was = {
            itemType: 'was', material: '4140', finish: 'HDG', size: 'M20 x L 600\n   Anchor Bolt: 4pcs\n   Base Plate: L 250 x W 250 x T 12mm x 1pc',
            accessories: { nut: { enabled: true, qty: 2, unitPrice: 0.5 }, custom: { enabled: true, text: 'welding', unitPrice: 1 } },
            formData: { trianglePlateQtyPerSet: '0' },
        };
        expect(itemGroupTitle(was)).toBe('4140 QT WELDING ANCHOR SET (HDG)');
        expect(itemDimension(was)).toBe('M20 x L 600\n   Anchor Bolt: 4pcs\n   Base Plate: L 250 x W 250 x T 12mm x 1pc\ncw 2nut + welding');
    });
});
