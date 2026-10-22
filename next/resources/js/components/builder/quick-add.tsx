import { CheckSquare, ClipboardPaste, FileUp, Layers, PencilLine, Square, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { computeItem, type FieldKey } from '@/builder/compute';
import type { DraftItem } from '@/builder/model';
import { formatDimensions, formatPrice } from '@/components/legacy/format';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { cn } from '@/lib/utils';
import { controlClass, SectionTitle } from './fields';
import { makeErr } from './item-editor';
import { AccessoriesFields, IdentityFields, PricePreview, PricingFields, SizeAndDimensionFields } from './item-fields';
import { TaskBody, TaskDialog } from './task-dialog';

/* QUICK ADD (Owner Smoke #2, locked definition) — AI-assisted extraction from
   what the customer sent:

     INPUT (pasted / WhatsApp text · image / photo / screenshot · PDF)
     → ANALYZE / EXTRACT → REVIEW extracted items → FIX uncertain fields
     → CALCULATE / PRICE → ADD CONFIRMED ITEMS

   It is NOT the grouped multi-row form (that is Batch Add). Every extracted
   item is a normal DraftItem (entryMode 'quick'), fixed with the same shared
   field sections as Manual Add and priced by the same engine call.

   The analyzer (AI / OCR / PDF backend) is Wave 3 Session I. Until it exists
   `quickAddAnalyzer` is null: the intake is shown, Analyze is honestly
   unavailable, and nothing typed or chosen here is analysed or sent anywhere.
   No parsing is invented. */

export type QuickAddInput = { kind: 'text'; text: string } | { kind: 'file'; file: File };

export interface ExtractedItem {
    /** A normal DraftItem; Qty stays at the default 1 when the source gave none. */
    item: DraftItem;
    /** Fields the analyzer was not sure about — highlighted for review (no invented confidence scores). */
    uncertain: FieldKey[];
    /** The source line / region the item came from, for the reviewer. */
    source?: string;
}

export type QuickAddAnalyzer = (input: QuickAddInput) => Promise<ExtractedItem[]>;

/** Session I connects the real analyzer here. Null = not available yet. */
export const quickAddAnalyzer: QuickAddAnalyzer | null = null;

const FIELD_LABELS: Partial<Record<FieldKey, string>> = {
    product: 'product', material: 'material', propertyClass: 'property class', sizeType: 'size type', finish: 'finish', size: 'size',
    diameter: 'Bar Ø', l: 'L', w: 'W', h: 'H', length: 'L', threadLen: 'TL', qty: 'Qty', nut: 'nut', fw: 'flat washer', costRate: 'cost rate',
};

interface ReviewRow extends ExtractedItem {
    confirmed: boolean;
    open: boolean;
}

export function QuickAdd({
    open,
    onOpenChange,
    onAdd,
    onSwitchMode,
    analyzer = quickAddAnalyzer,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAdd: (items: DraftItem[]) => void;
    /** Offer the other entry modes while Analyze is unavailable. */
    onSwitchMode?: (mode: 'manual' | 'batch') => void;
    analyzer?: QuickAddAnalyzer | null;
}) {
    const [tab, setTab] = useState<'text' | 'file'>('text');
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState<string | null>(null);
    const [rows, setRows] = useState<ReviewRow[] | null>(null);

    useEffect(() => {
        if (open) {
            setTab('text');
            setText('');
            setFile(null);
            setBusy(false);
            setFailed(null);
            setRows(null);
        }
    }, [open]);

    const computed = useMemo(() => (rows ?? []).map((r) => computeItem(r.item)), [rows]);
    const confirmedValid = (rows ?? []).filter((r, i) => r.confirmed && computed[i]!.valid);
    const hasInput = tab === 'text' ? text.trim() !== '' : file !== null;

    const analyze = async () => {
        if (!analyzer || !hasInput) return;
        setBusy(true);
        setFailed(null);
        try {
            const out = await analyzer(tab === 'text' ? { kind: 'text', text } : { kind: 'file', file: file! });
            setRows(out.map((x) => ({ ...x, item: { ...x.item, entryMode: 'quick' }, confirmed: x.uncertain.length === 0, open: x.uncertain.length > 0 })));
        } catch (e) {
            setFailed(e instanceof Error ? e.message : 'The analysis did not complete');
        } finally {
            setBusy(false);
        }
    };

    const setRow = (i: number, patch: Partial<ReviewRow>) => setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...patch } : r)) : rs));

    const reviewing = rows !== null;
    return (
        <TaskDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Quick Add"
            description={reviewing ? 'Review the extracted items, fix anything uncertain, then add the confirmed ones.' : 'AI extract items from customer text, an image or a PDF.'}
            width={1040}
            testId="quick-add"
            footer={
                reviewing ? (
                    <>
                        <Button type="button" variant="ghost" onClick={() => setRows(null)} data-testid="qa-back-to-input">
                            Back to input
                        </Button>
                        <Button type="button" variant="primary" disabled={confirmedValid.length === 0} onClick={() => onAdd(confirmedValid.map((r) => r.item))} data-testid="qa-add-confirmed">
                            Add confirmed items ({confirmedValid.length})
                        </Button>
                    </>
                ) : (
                    <>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            disabled={!analyzer || !hasInput || busy}
                            loading={busy}
                            onClick={analyze}
                            title={analyzer ? undefined : 'AI analysis is not connected yet'}
                            data-testid="qa-analyze"
                        >
                            Analyze
                        </Button>
                    </>
                )
            }
        >
            <TaskBody>
                {!reviewing ? (
                    <div className="flex flex-col gap-4" data-testid="qa-intake">
                        {!analyzer ? (
                            <InlineAlert tone="info" title="AI analysis is not connected yet" className="" >
                                <span data-testid="qa-unavailable">
                                    Analyze arrives with the Quick Add AI backend (Wave 3 · Session I). Nothing pasted or chosen here is analysed or sent anywhere yet.
                                </span>
                                {onSwitchMode ? (
                                    <span className="mt-2 flex flex-wrap gap-2">
                                        <Button type="button" variant="secondary" size="sm" onClick={() => onSwitchMode('manual')} data-testid="qa-switch-manual">
                                            <PencilLine aria-hidden="true" /> Manual Add
                                        </Button>
                                        <Button type="button" variant="secondary" size="sm" onClick={() => onSwitchMode('batch')} data-testid="qa-switch-batch">
                                            <Layers aria-hidden="true" /> Batch Add
                                        </Button>
                                    </span>
                                ) : null}
                            </InlineAlert>
                        ) : null}
                        <div role="tablist" aria-label="Quick Add input" className="flex gap-2 border-b border-border">
                            {[
                                { id: 'text' as const, label: 'Paste Text', icon: ClipboardPaste },
                                { id: 'file' as const, label: 'Upload Image / PDF', icon: FileUp },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t.id}
                                    onClick={() => setTab(t.id)}
                                    className={cn(
                                        '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm',
                                        tab === t.id ? 'border-accent font-semibold text-accent' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                                    )}
                                    data-testid={`qa-tab-${t.id}`}
                                >
                                    <t.icon className="size-4" aria-hidden="true" />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        {tab === 'text' ? (
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="qa-text" className="text-xs font-medium text-muted-foreground">
                                    Customer / WhatsApp text
                                </label>
                                <textarea
                                    id="qa-text"
                                    rows={9}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder={'e.g.\nM12 sag rod 1245 tl100 zp 30pcs\nM16 l bolt 900x70 tl150 pl 20pcs'}
                                    className={cn(controlClass, 'h-auto min-h-48 py-2 font-mono text-sm')}
                                    data-testid="qa-text"
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <label
                                    htmlFor="qa-file"
                                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-muted/40 px-4 py-10 text-center text-sm text-muted-foreground hover:bg-surface-muted"
                                >
                                    <FileUp className="size-6" aria-hidden="true" />
                                    <span className="font-medium text-foreground">Choose an image, photo, screenshot or PDF</span>
                                    <span className="text-xs">Kept in this browser only — not uploaded</span>
                                </label>
                                <input
                                    id="qa-file"
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="sr-only"
                                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                    data-testid="qa-file"
                                />
                                {file ? (
                                    <p className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-sm" data-testid="qa-file-name">
                                        <span className="truncate">{file.name}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                                    </p>
                                ) : null}
                            </div>
                        )}
                        {failed ? (
                            <InlineAlert tone="error" title="Analysis failed">
                                {failed}
                            </InlineAlert>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3" data-testid="qa-review">
                        <SectionTitle aside={<span className="text-xs text-muted-foreground">{rows!.length} extracted</span>}>Extracted items</SectionTitle>
                        {rows!.length === 0 ? <p className="text-sm text-muted-foreground">Nothing was extracted — check the input, or use Manual Add.</p> : null}
                        <ol className="flex flex-col gap-2">
                            {rows!.map((r, i) => {
                                const c = computed[i]!;
                                const err = makeErr(r.item, c, true);
                                const prefix = `qr${i}`;
                                return (
                                    <li key={r.item.uid} className={cn('rounded-[var(--radius-md)] border p-3', c.valid ? 'border-border' : 'border-danger/40 bg-danger-soft/30')} data-testid="qa-review-item">
                                        <div className="flex items-start gap-3">
                                            <button
                                                type="button"
                                                role="checkbox"
                                                aria-checked={r.confirmed}
                                                aria-label={`Confirm item ${i + 1}`}
                                                onClick={() => setRow(i, { confirmed: !r.confirmed })}
                                                className="mt-0.5 text-muted-foreground hover:text-foreground"
                                                data-testid="qa-confirm"
                                            >
                                                {r.confirmed ? <CheckSquare className="size-5 text-accent" aria-hidden="true" /> : <Square className="size-5" aria-hidden="true" />}
                                            </button>
                                            <div className="min-w-0 flex-1 text-sm">
                                                <p className="font-medium">{c.title}</p>
                                                <p className="text-muted-foreground tabular-nums">
                                                    {c.dimensionLine ? formatDimensions(c.dimensionLine) : '—'} · Qty {r.item.qty || '—'}
                                                    {c.pricing && c.pricing.finalUnitPrice > 0 ? ` · ${formatPrice(c.pricing.finalUnitPrice)}` : ''}
                                                </p>
                                                {r.source ? <p className="mt-0.5 truncate font-mono text-xs text-subtle-foreground">“{r.source}”</p> : null}
                                                {r.uncertain.length ? (
                                                    <p className="mt-1 text-xs text-warning" data-testid="qa-uncertain">
                                                        Check: {r.uncertain.map((f) => FIELD_LABELS[f] ?? f).join(', ')}
                                                    </p>
                                                ) : null}
                                                {!c.valid ? <p className="mt-1 text-xs text-danger">Fix {Object.keys(c.errors).length} field(s) before adding</p> : null}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                <Button type="button" variant="ghost" size="sm" onClick={() => setRow(i, { open: !r.open })} data-testid="qa-fix">
                                                    {r.open ? 'Done' : 'Review / fix'}
                                                </Button>
                                                <Button type="button" variant="ghost" size="icon" aria-label={`Remove extracted item ${i + 1}`} onClick={() => setRows((rs) => rs!.filter((_, j) => j !== i))}>
                                                    <Trash2 aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>
                                        {r.open ? (
                                            <div className="mt-3 flex flex-col gap-4 border-t border-border pt-3">
                                                <IdentityFields prefix={prefix} item={r.item} computed={c} onChange={(item) => setRow(i, { item })} err={err} />
                                                <SizeAndDimensionFields prefix={prefix} item={r.item} computed={c} onChange={(item) => setRow(i, { item })} err={err} />
                                                <AccessoriesFields prefix={prefix} value={r.item.accessories} onChange={(accessories) => setRow(i, { item: { ...r.item, accessories } })} err={err} />
                                                <PricingFields prefix={prefix} item={r.item} computed={c} onChange={(item) => setRow(i, { item })} err={err} />
                                                <PricePreview computed={c} />
                                            </div>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}
            </TaskBody>
        </TaskDialog>
    );
}
