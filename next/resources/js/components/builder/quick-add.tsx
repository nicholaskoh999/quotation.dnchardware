import { CheckCircle2, ClipboardPaste, Eye, FileUp, FlaskConical, Layers, PencilLine, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { computeItem, type ComputedItem, type FieldKey } from '@/builder/compute';
import type { DraftItem } from '@/builder/model';
import { DEMO_LABEL, demoExtraction } from '@/builder/quick-add-demo';
import { formatDimensions, formatPrice } from '@/components/legacy/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { cn } from '@/lib/utils';
import { controlClass, SectionTitle } from './fields';
import { ItemEditor } from './item-editor';
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
   No parsing is invented.

   "View demo analysis" (Loop #2) opens the SAME review screen on a fixed
   local fixture (builder/quick-add-demo.ts), labelled "Demo extracted items —
   not real AI output" for as long as it is shown. Review rows are Ready or
   Needs review; Edit opens the shared ItemEditor (Manual Add's fields and
   engine); "Add confirmed items" stays blocked until nothing needs review. */

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

export const FIELD_LABELS: Partial<Record<FieldKey, string>> = {
    product: 'product', material: 'material', propertyClass: 'property class', sizeType: 'size type', finish: 'finish', size: 'size',
    diameter: 'Bar Ø', l: 'L', w: 'W', h: 'H', length: 'L', threadLen: 'TL', qty: 'Qty', nut: 'nut', fw: 'flat washer', costRate: 'cost rate',
};

interface ReviewRow extends ExtractedItem {
    /** The person opened it in the editor and saved: its uncertainty is resolved. */
    reviewed: boolean;
}

/** Ready = the engine accepts it and nothing uncertain is left unreviewed. */
export function rowNeedsReview(r: ReviewRow, c: ComputedItem): boolean {
    return !c.valid || (r.uncertain.length > 0 && !r.reviewed);
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
    const [demo, setDemo] = useState(false);
    const [editing, setEditing] = useState<number | null>(null);

    useEffect(() => {
        if (open) {
            setTab('text');
            setText('');
            setFile(null);
            setBusy(false);
            setFailed(null);
            setRows(null);
            setDemo(false);
            setEditing(null);
        }
    }, [open]);

    const computed = useMemo(() => (rows ?? []).map((r) => computeItem(r.item)), [rows]);
    const needs = (rows ?? []).map((r, i) => rowNeedsReview(r, computed[i]!));
    const needCount = needs.filter(Boolean).length;
    const total = computed.reduce((sum, c) => sum + (c.pricing?.totalAmount ?? 0), 0);
    const canAdd = rows !== null && rows.length > 0 && needCount === 0;
    const hasInput = tab === 'text' ? text.trim() !== '' : file !== null;

    const toRows = (out: ExtractedItem[]): ReviewRow[] => out.map((x) => ({ ...x, item: { ...x.item, entryMode: 'quick' }, reviewed: false }));

    const analyze = async () => {
        if (!analyzer || !hasInput) return;
        setBusy(true);
        setFailed(null);
        try {
            const out = await analyzer(tab === 'text' ? { kind: 'text', text } : { kind: 'file', file: file! });
            setDemo(false);
            setRows(toRows(out));
        } catch (e) {
            setFailed(e instanceof Error ? e.message : 'The analysis did not complete');
        } finally {
            setBusy(false);
        }
    };

    // Local fixture only: no input is read, nothing is sent, uploaded or stored.
    const viewDemo = () => {
        setFailed(null);
        setDemo(true);
        setRows(toRows(demoExtraction()));
    };

    const reviewing = rows !== null;
    const editingRow = editing !== null && rows ? rows[editing] : undefined;
    return (
        <>
        <TaskDialog
            open={open}
            onOpenChange={onOpenChange}
            title={demo && reviewing ? 'Quick Add · demo review' : 'Quick Add'}
            description={reviewing ? 'Review the extracted items, fix anything that needs review, then add them.' : 'AI extract items from customer text, an image or a PDF.'}
            width={1040}
            testId="quick-add"
            footer={
                reviewing ? (
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <p className={cn('min-w-0 text-sm tabular-nums', needCount ? 'text-warning' : 'text-muted-foreground')} data-testid="qa-summary" aria-live="polite">
                            {rows!.length} item{rows!.length === 1 ? '' : 's'}
                            {needCount ? (
                                <>
                                    {' · '}
                                    <span className="font-medium">{needCount} need{needCount === 1 ? 's' : ''} review</span>
                                </>
                            ) : rows!.length ? (
                                <>
                                    {' · all ready · '}
                                    <span className="font-semibold text-foreground">{formatPrice(total)}</span>
                                </>
                            ) : null}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button type="button" variant="ghost" className="px-3" onClick={() => setRows(null)} data-testid="qa-back-to-input">
                                Back to input
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                className="flex-1 sm:flex-none"
                                disabled={!canAdd}
                                title={needCount ? 'Fix the items that need review first' : undefined}
                                onClick={() => onAdd(rows!.map((r) => r.item))}
                                data-testid="qa-add-confirmed"
                            >
                                Add confirmed items{canAdd ? ` (${rows!.length})` : ''}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={viewDemo} data-testid="qa-demo">
                                <Eye aria-hidden="true" /> <span className="hidden sm:inline">View demo analysis</span>
                                <span className="sm:hidden">Demo</span>
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
                        </div>
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
                                <span className="mt-1 block text-xs" data-testid="qa-demo-caption">
                                    <span className="font-medium">View demo analysis</span> shows the review screen on fixed sample items — demo only, not real AI output.
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
                        {demo ? (
                            <div
                                className="flex items-start gap-2 rounded-[var(--radius-md)] border border-special/30 bg-special-soft px-3 py-2 text-sm text-special"
                                role="note"
                                data-testid="qa-demo-banner"
                            >
                                <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <span>
                                    <span className="font-semibold">{DEMO_LABEL}</span>
                                    <span className="block text-xs opacity-90">Fixed sample items to preview the review flow. Your input was not read or sent anywhere.</span>
                                </span>
                            </div>
                        ) : null}
                        <SectionTitle aside={<span className="text-xs text-muted-foreground">{rows!.length} extracted</span>}>Extracted items</SectionTitle>
                        {rows!.length === 0 ? <p className="text-sm text-muted-foreground">Nothing was extracted — check the input, or use Manual Add.</p> : null}
                        <ol className="flex flex-col gap-2">
                            {rows!.map((r, i) => {
                                const c = computed[i]!;
                                const need = needs[i]!;
                                const facts = [
                                    ['Size', r.item.size || '—'],
                                    ['Bar Ø', c.diameter !== null ? `${c.diameter} mm` : '—'],
                                    ['Dims', c.dimensionLine ? formatDimensions(c.dimensionLine) : '—'],
                                    ['Qty', r.item.qty || '—'],
                                ] as const;
                                return (
                                    <li
                                        key={r.item.uid}
                                        className={cn('rounded-[var(--radius-md)] border p-3', need ? 'border-warning/40 bg-warning-soft/30' : 'border-border')}
                                        data-testid="qa-review-item"
                                        data-status={need ? 'needs-review' : 'ready'}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="mt-0.5 w-6 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">#{i + 1}</span>
                                            <div className="min-w-0 flex-1 text-sm">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <p className="font-medium" data-testid="qa-item-title">
                                                        {c.title}
                                                    </p>
                                                    {need ? (
                                                        <Badge tone="warning" data-testid="qa-status">
                                                            <TriangleAlert aria-hidden="true" /> Needs review
                                                        </Badge>
                                                    ) : (
                                                        <Badge tone="success" data-testid="qa-status">
                                                            <CheckCircle2 aria-hidden="true" /> Ready
                                                        </Badge>
                                                    )}
                                                </div>
                                                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs sm:gap-x-5" data-testid="qa-item-facts">
                                                    {facts.map(([k, v]) => (
                                                        <div key={k} className={cn('flex min-w-0 gap-1 whitespace-nowrap', k === 'Dims' && 'max-sm:order-last max-sm:basis-full')}>
                                                            <dt className="text-muted-foreground">{k}</dt>
                                                            <dd className="truncate font-medium tabular-nums">{v}</dd>
                                                        </div>
                                                    ))}
                                                    {c.pricing && c.pricing.totalAmount > 0 ? (
                                                        <div className="flex gap-1 whitespace-nowrap">
                                                            <dt className="text-muted-foreground">Total</dt>
                                                            <dd className="font-medium tabular-nums">{formatPrice(c.pricing.totalAmount)}</dd>
                                                        </div>
                                                    ) : null}
                                                </dl>
                                                {r.source ? <p className="mt-1 truncate font-mono text-xs text-subtle-foreground">“{r.source}”</p> : null}
                                                {r.uncertain.length && !r.reviewed ? (
                                                    <p className="mt-1 text-xs text-warning" data-testid="qa-uncertain">
                                                        Check: {r.uncertain.map((f) => FIELD_LABELS[f] ?? f).join(', ')}
                                                    </p>
                                                ) : null}
                                                {!c.valid ? (
                                                    <p className="mt-1 text-xs text-danger" data-testid="qa-invalid">
                                                        {Object.values(c.errors)[0]}
                                                        {Object.keys(c.errors).length > 1 ? ` (+${Object.keys(c.errors).length - 1} more)` : ''}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                <Button type="button" variant={need ? 'secondary' : 'ghost'} size="sm" onClick={() => setEditing(i)} data-testid="qa-edit">
                                                    <PencilLine aria-hidden="true" /> {need ? 'Fix' : 'Edit'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Remove extracted item ${i + 1}`}
                                                    onClick={() => setRows((rs) => rs!.filter((_, j) => j !== i))}
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}
            </TaskBody>
        </TaskDialog>
        {editingRow ? (
            <ItemEditor
                open
                onOpenChange={(o) => !o && setEditing(null)}
                initial={editingRow.item}
                isNew={false}
                itemNumber={editing! + 1}
                title={`${demo ? 'Demo item' : 'Extracted item'} ${editing! + 1} · review`}
                onSave={(item) => {
                    setRows((rs) => (rs ? rs.map((r, j) => (j === editing ? { ...r, item: { ...item, entryMode: 'quick' }, reviewed: true } : r)) : rs));
                    setEditing(null);
                }}
            />
        ) : null}
        </>
    );
}
