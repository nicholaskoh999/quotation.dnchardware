import { computeGeometry } from './geometry';
import type { ProductType } from './products';

/* Test support: map a golden fixture input (legacy form field names) onto the engine's geometry input. */

export type GoldenGeometryInput = Record<string, string | number | boolean> & { type: ProductType };
type In = GoldenGeometryInput;

/* Recompute developed length + weight from the golden INPUT through the engine. */
export function geometryFromGoldenInput(i: In): ReturnType<typeof computeGeometry> {
    const manual = !!i.manualDevelopedLength;
    const bent = !['sagrod', 'stud', 'anchorbolt', 'plate', 'others'].includes(i.type);
    return computeGeometry({
        product: i.type,
        diameter: i.diameter as number,
        // A bent product's form field "length" is its developed (total) length box.
        length: bent ? undefined : ((i.length ?? i.l) as number),
        l: i.l as number,
        w: i.w as number,
        h: i.h as number,
        id: i.id as number,
        ih: i.ih as number,
        oh: i.oh as number,
        s: i.s as number,
        t: i.t as number,
        plateType: i.plateType as 'ms_plate' | 'triangle_plate' | undefined,
        triL: i['tri-l'] as number,
        triH: i['tri-h'] as number,
        triT: i['tri-t'] as number,
        developedLength: bent && (manual || i.type === 'lbolt45') ? (i.length as number) : undefined,
    });
}

