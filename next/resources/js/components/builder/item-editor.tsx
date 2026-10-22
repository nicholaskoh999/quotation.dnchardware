import { useEffect, useMemo, useState } from 'react';
import { computeItem, type ComputedItem, type FieldKey } from '@/builder/compute';
import type { DraftItem } from '@/builder/model';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/feedback';
import { SectionTitle } from './fields';
import { AccessoriesFields, IdentityFields, PricePreview, PricingFields, SizeAndDimensionFields, type ErrFn } from './item-fields';
import { TaskBody, TaskDialog } from './task-dialog';

/* Manual Add / Edit item — ONE item keyed by hand: Product → Material →
   Treatment → Size Type → Finish → Size → Bar Ø → dimensions → Qty →
   Accessories → Pricing. A centred large dialog on desktop / tablet and a
   full-screen task on a phone (handoff §10, Owner Smoke #2). Errors appear next to the
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
        case 'override':
            return item.pricing.override !== null && item.pricing.override.trim() !== '';
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

    const title = isNew ? `Manual Add · item ${itemNumber}` : `Edit item ${itemNumber}`;
    return (
        <TaskDialog
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={isNew ? 'Enter one item manually.' : computed.title}
            width={880}
            testId="item-editor"
            footer={
                <>
                    <p className="min-w-0 truncate text-sm text-muted-foreground" data-testid="ed-title">
                        {computed.title}
                    </p>
                    <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="item-editor-form" variant="primary" data-testid="ed-submit">
                            {isNew ? 'Add item' : 'Save item'}
                        </Button>
                    </div>
                </>
            }
        >
            <form
                id="item-editor-form"
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                }}
                noValidate
            >
                <TaskBody>
                    <div className="flex flex-col gap-6">
                        <section className="flex flex-col gap-3">
                            <SectionTitle>Item</SectionTitle>
                            <IdentityFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                        </section>
                        <section className="flex flex-col gap-3">
                            <SectionTitle>{computed.spec.hasSize ? 'Size, Bar Ø & dimensions' : 'Dimensions'}</SectionTitle>
                            <SizeAndDimensionFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                        </section>
                        <section className="flex flex-col gap-3">
                            <SectionTitle>Accessories</SectionTitle>
                            <AccessoriesFields prefix="ed" value={item.accessories} onChange={(accessories) => setItem({ ...item, accessories })} err={err} />
                        </section>
                        <section className="flex flex-col gap-3">
                            <SectionTitle>Pricing</SectionTitle>
                            <PricingFields prefix="ed" item={item} computed={computed} onChange={setItem} err={err} />
                            {computed.errors.price && attempted ? (
                                <p role="alert" className="text-xs text-danger" data-testid="error-ed-price">
                                    {computed.errors.price}
                                </p>
                            ) : null}
                            <PricePreview computed={computed} testId="ed-preview" />
                        </section>
                    </div>
                </TaskBody>
            </form>
        </TaskDialog>
    );
}
