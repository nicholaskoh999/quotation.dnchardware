import { useEffect, useMemo, useState } from 'react';
import { computeItem, type ComputedItem, type FieldKey } from '@/builder/compute';
import type { DraftItem } from '@/builder/model';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { notify } from '@/lib/feedback';
import { SectionTitle, SheetHeading } from './fields';
import { AccessoriesFields, IdentityFields, PricePreview, PricingFields, SizeAndDimensionFields, type ErrFn } from './item-fields';

/* Manual Add / Edit item — one full item form in a side sheet on desktop and
   a full-screen task on a phone (handoff §10). Errors appear next to the
   field: as soon as a field holds something malformed, and for missing
   required fields once the person tries to add / save. */

/** Does the field already hold something the person typed? (then a malformed value is flagged live) */
function hasContent(item: DraftItem, f: FieldKey): boolean {
    switch (f) {
        case 'size':
            return item.size.trim() !== '';
        case 'diameter':
            return item.diameterOverride.trim() !== '' || item.size.trim() !== '';
        case 'qty':
            return item.qty.trim() !== '';
        case 'productName':
        case 'finish':
        case 'sizeType':
        case 'price':
            return false;
        case 'propertyClass':
            return item.treatment === 'HARDEN';
        case 'nut':
        case 'fw':
        case 'custom':
            return item.accessories[f] !== null;
        case 'costRate':
        case 'addCost':
        case 'markup':
            return item.pricing[f] !== null;
        case 'manualUnitPrice':
            return item.pricing.manualUnitPrice.trim() !== '';
        default: {
            const v = (item.dims as unknown as Record<string, string>)[f];
            return typeof v === 'string' && v.trim() !== '';
        }
    }
}

export function makeErr(item: DraftItem, computed: ComputedItem, attempted: boolean): ErrFn {
    return (f) => (attempted || hasContent(item, f) ? computed.errors[f] : undefined);
}

export function ItemEditor({
    open,
    onOpenChange,
    initial,
    isNew,
    itemNumber,
    onSave,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initial: DraftItem;
    isNew: boolean;
    /** The item's number in the quotation (edit) or the number it will get (add). */
    itemNumber: number;
    onSave: (item: DraftItem) => void;
}) {
    const [item, setItem] = useState(initial);
    const [attempted, setAttempted] = useState(false);
    useEffect(() => {
        if (open) {
            setItem(initial);
            setAttempted(false);
        }
    }, [open, initial]);
    const computed = useMemo(() => computeItem(item), [item]);
    const err = makeErr(item, computed, attempted);

    const submit = () => {
        if (!computed.valid) {
            setAttempted(true);
            const n = Object.keys(computed.errors).length;
            notify.error(`Fix ${n} field${n === 1 ? '' : 's'} before ${isNew ? 'adding' : 'saving'} this item`);
            window.setTimeout(() => document.querySelector<HTMLElement>('[data-testid="item-editor"] [aria-invalid="true"]')?.focus(), 0);
            return;
        }
        onSave(item);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                title={isNew ? `Add item ${itemNumber}` : `Edit item ${itemNumber}`}
                description={isNew ? 'Manual Add — any product, every field.' : computed.title}
                hideTitle
                className="w-full max-w-none gap-0 p-0 sm:w-[min(48rem,94vw)]"
                data-testid="item-editor"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <SheetHeading title={isNew ? `Add item ${itemNumber}` : `Edit item ${itemNumber}`} description={isNew ? 'Manual Add — any product, every field.' : computed.title} />
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault();
                        submit();
                    }}
                    noValidate
                >
                    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 sm:px-6">
                        <div className="flex flex-col gap-6">
                            <section className="flex flex-col gap-3">
                                <SectionTitle>Item</SectionTitle>
                                <IdentityFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                            </section>
                            <section className="flex flex-col gap-3">
                                <SectionTitle>{computed.spec.hasSize ? 'Size & dimensions' : 'Dimensions'}</SectionTitle>
                                <SizeAndDimensionFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                            </section>
                            <section className="flex flex-col gap-3">
                                <SectionTitle>Accessories</SectionTitle>
                                <AccessoriesFields prefix="ed" value={item.accessories} onChange={(accessories) => setItem({ ...item, accessories })} err={err} />
                            </section>
                            <section className="flex flex-col gap-3">
                                <SectionTitle>Pricing</SectionTitle>
                                <PricingFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                                {computed.errors.price && (attempted || computed.pricing?.finalUnitPrice === 0) ? (
                                    <p role="alert" className="text-xs text-danger" data-testid="error-ed-price">
                                        {computed.errors.price}
                                    </p>
                                ) : null}
                                <PricePreview computed={computed} testId="ed-preview" />
                            </section>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-border bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                        <p className="min-w-0 truncate text-sm text-muted-foreground" data-testid="ed-title">
                            {computed.title}
                        </p>
                        <div className="flex shrink-0 gap-2">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" variant="primary" data-testid="ed-submit">
                                {isNew ? 'Add item' : 'Save item'}
                            </Button>
                        </div>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
