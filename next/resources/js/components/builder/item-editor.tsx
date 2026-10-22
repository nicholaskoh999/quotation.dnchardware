import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

/** Mac keyboards say ⌘, everything else Ctrl. */
export function modKeyLabel(): string {
    if (typeof navigator === 'undefined') return 'Ctrl';
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || nav.platform || '';
    return /mac|iphone|ipad|ipod/i.test(platform) ? '⌘' : 'Ctrl';
}

/** A muted keyboard hint; desktop / tablet only (phones have no keyboard shortcuts). */
export function Kbd({ children }: { children: string }) {
    return (
        <kbd className="hidden rounded border border-border bg-surface-muted px-1 py-px font-sans text-[11px] leading-4 font-normal text-subtle-foreground sm:inline-block" data-testid="kbd-hint">
            {children}
        </kbd>
    );
}

/**
 * Should a key press inside the form be left alone (Enter in a textarea, Enter
 * that picks an open combobox / dropdown option, a focused native select, an
 * auto-repeated key or an IME composition)?
 */
export function keyBelongsToField(e: KeyboardEvent<HTMLElement>): boolean {
    if (e.repeat || e.nativeEvent.isComposing) return true;
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.tagName === 'BUTTON' || t.tagName === 'SUMMARY' || t.tagName === 'A') return true;
    if (e.defaultPrevented) return true; // a combobox already used it to pick an option
    if (t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'radio')) return true;
    return false;
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
    context,
    title: titleOverride,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initial: DraftItem;
    isNew: boolean;
    /** The item's number in the quotation (edit) or the number it will get (add). */
    itemNumber: number;
    /** keepOpen = "Add & another": the parent appends the item and hands a fresh `initial`. */
    onSave: (item: DraftItem, opts: { keepOpen: boolean }) => void;
    /** Live quotation context for continuous entry, e.g. "7 items · RM 412.30". */
    context?: string;
    /** Dialog title override (Quick Add review: "Demo item 2 · review"). */
    title?: string;
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
    const mod = useMemo(modKeyLabel, []);
    const keepOpenRef = useRef(false);

    const submit = (keepOpen = false) => {
        if (!computed.valid) {
            setAttempted(true);
            const n = Object.keys(computed.errors).length;
            notify.error(`Fix ${n} field${n === 1 ? '' : 's'} before ${isNew ? 'adding' : 'saving'} this item`);
            window.setTimeout(() => document.querySelector<HTMLElement>('[data-testid="item-editor"] [aria-invalid="true"]')?.focus(), 0);
            return;
        }
        onSave(item, { keepOpen: isNew && keepOpen });
        if (isNew && keepOpen) {
            // back to the first per-item field; on a phone only scroll there (no keyboard / suggestion list pops up)
            window.setTimeout(() => {
                const el = document.querySelector<HTMLElement>('[data-testid="item-editor"] #ed-size');
                if (!el) return;
                if (window.matchMedia('(max-width: 639px)').matches) el.scrollIntoView({ block: 'center' });
                else el.focus();
            }, 0);
        }
    };

    /* Enter = Add & another (Save on Edit) · Ctrl/⌘+Enter = Add and close ·
       Esc = Cancel (Radix). Enter that belongs to a field is left alone. */
    const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
        if (e.key !== 'Enter' || e.shiftKey || e.altKey) return;
        const withMod = e.ctrlKey || e.metaKey;
        const inTextarea = (e.target as HTMLElement).tagName === 'TEXTAREA';
        if (e.repeat) {
            e.preventDefault(); // a held Enter never adds the same item twice
            return;
        }
        if ((e.target as HTMLElement).getAttribute('aria-expanded') === 'true' && !e.defaultPrevented) {
            e.preventDefault(); // Enter on an open list only closes it — never submits
            return;
        }
        if (keyBelongsToField(e) && !(withMod && inTextarea)) return;
        e.preventDefault();
        submit(!withMod);
    };

    const title = titleOverride ?? (isNew ? `Manual Add · item ${itemNumber}` : `Edit item ${itemNumber}`);
    return (
        <TaskDialog
            open={open}
            onOpenChange={onOpenChange}
            title={title}
            description={isNew ? 'Enter one item manually.' : computed.title}
            width={880}
            testId="item-editor"
            footer={
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex min-w-0 items-baseline justify-between gap-3 sm:flex-col sm:items-start sm:justify-start sm:gap-0">
                        <p className="min-w-0 truncate text-sm text-muted-foreground" data-testid="ed-title">
                            {computed.title}
                        </p>
                        {isNew && context ? (
                            <p className="shrink-0 text-xs whitespace-nowrap text-subtle-foreground tabular-nums" data-testid="ed-context">
                                {context}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2" data-testid="ed-actions">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="px-3" data-testid="ed-cancel">
                            Cancel <Kbd>Esc</Kbd>
                        </Button>
                        {isNew ? (
                            <>
                                <Button
                                    type="submit"
                                    form="item-editor-form"
                                    variant="primary"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => (keepOpenRef.current = true)}
                                    data-testid="ed-add-another"
                                >
                                    Add &amp; another <Kbd>Enter</Kbd>
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="flex-1 sm:flex-none"
                                    onClick={() => submit(false)}
                                    data-testid="ed-submit"
                                >
                                    Add item <Kbd>{`${mod}+Enter`}</Kbd>
                                </Button>
                            </>
                        ) : (
                            <Button type="submit" form="item-editor-form" variant="primary" data-testid="ed-submit">
                                Save item <Kbd>Enter</Kbd>
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <form
                id="item-editor-form"
                className="flex min-h-0 flex-1 flex-col"
                onSubmit={(e) => {
                    e.preventDefault();
                    const keep = keepOpenRef.current;
                    keepOpenRef.current = false;
                    submit(keep);
                }}
                onKeyDown={onKeyDown}
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
