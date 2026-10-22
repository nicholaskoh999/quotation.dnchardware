import { ClipboardCopy, Layers, Lock, MessageCircle, PencilLine, Printer, Save, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDayFirst, todayIso } from '@/builder/dates';
import { emptyItem, type DraftItem } from '@/builder/model';
import { BATCH_ADD_PRODUCTS, BUILDER_PRODUCTS, type BuilderProduct } from '@/builder/products';
import { useBuilder, type DraftStatus } from '@/builder/use-builder';
import { CustomerSection } from '@/components/builder/customer-section';
import { ItemEditor } from '@/components/builder/item-editor';
import { ItemsTable } from '@/components/builder/items-table';
import { BatchAdd } from '@/components/builder/batch-add';
import { QuickAdd } from '@/components/builder/quick-add';
import { formatPrice } from '@/components/legacy/format';
import { useShell } from '@/components/shell/use-shell';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/inline-alert';
import { PageHeader } from '@/components/ui/page-header';
import AppLayout from '@/layouts/app-layout';
import { notify } from '@/lib/feedback';
import { cn } from '@/lib/utils';

/* Route quotations.create — the Quotation Builder (Wave 2 · Session E).

   Header / customer → Items → Summary → Draft status / actions. Three entry
   modes, one item model (Owner Smoke #2):
     Quick Add   AI extract from customer text / image / PDF → review → add
                 (the analyzer is Session I; Analyze is shown unavailable)
     Manual Add  one item keyed by hand
     Batch Add   common fields once, several similar rows Calculations come from
   the domain engine (builder/compute.ts). Work is autosaved on this device as
   a LOCAL DRAFT (never a quotation); formal Save + Q-number is the write path
   (Session G) and Print / WhatsApp / Copy need a saved quotation (Session H),
   so they are shown locked, never faked. `?mode=quick|manual|batch` and
   `?product=<key>` (the + sheet, Quick Actions, Frequent Products → Manual
   Add on that product) open the matching entry mode. */

type EditorState = { open: false } | { open: true; isNew: boolean; index: number; item: DraftItem };

function timeOf(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DraftStatusText({ status }: { status: DraftStatus }) {
    const text =
        status.state === 'saved'
            ? `Kept on this device · ${timeOf(status.savedAt)}`
            : status.state === 'pending'
              ? 'Keeping on this device…'
              : status.state === 'unavailable'
                ? 'This browser cannot keep a draft'
                : status.state === 'paused'
                  ? 'Not kept yet — choose Continue draft or Discard first'
                  : 'Nothing entered yet';
    return (
        <span className={cn('text-xs', status.state === 'unavailable' ? 'text-danger' : status.state === 'paused' ? 'text-warning' : 'text-muted-foreground')} data-testid="draft-status" data-state={status.state}>
            {text}
        </span>
    );
}

export default function QuotationsCreate() {
    const { url, user } = useShell();
    const username = user?.username ?? 'anonymous';
    const [today] = useState(() => todayIso());
    const { quotation, reading, actions, draftStatus, recovered, continueDraft, discardRecovered, discardCurrent, meaningful } = useBuilder({ username, todayIso: today });
    const [editor, setEditor] = useState<EditorState>({ open: false });
    const [quickOpen, setQuickOpen] = useState(false);
    const [batchOpen, setBatchOpen] = useState(false);
    const [batchProduct, setBatchProduct] = useState<BuilderProduct | undefined>();
    const [checked, setChecked] = useState(false);
    const itemsRef = useRef<HTMLElement>(null);

    // Entry points: ?mode=quick|manual and ?product=<key>.
    const query = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);
    const opened = useRef(false);
    useEffect(() => {
        if (opened.current) return;
        opened.current = true;
        const mode = query.get('mode');
        const product = query.get('product') as BuilderProduct | null;
        const known = product && (BUILDER_PRODUCTS as readonly string[]).includes(product) ? product : undefined;
        if (mode === 'quick') setQuickOpen(true);
        else if (mode === 'batch') {
            setBatchProduct(known && BATCH_ADD_PRODUCTS.includes(known) ? known : undefined);
            setBatchOpen(true);
        } else if (mode === 'manual' || known) {
            setEditor({ open: true, isNew: true, index: quotation.items.length, item: emptyItem(known ?? 'sagrod', 'manual') });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openManual = () => setEditor({ open: true, isNew: true, index: quotation.items.length, item: emptyItem('sagrod', 'manual') });
    const openQuick = () => setQuickOpen(true);
    const openBatch = () => {
        setBatchProduct(undefined);
        setBatchOpen(true);
    };

    const saveFromEditor = (item: DraftItem) => {
        if (!editor.open) return;
        if (editor.isNew) {
            actions.addItems([item]);
            notify.success(`Item ${quotation.items.length + 1} added`);
        } else {
            actions.updateItem(item);
            notify.success(`Item ${editor.index + 1} updated`);
        }
        setEditor({ open: false });
    };

    const remove = (index: number) => {
        const item = quotation.items[index];
        if (!item) return;
        actions.removeItem(item.uid);
        notify.undoable(`Item ${index + 1} removed`, () => {
            actions.insertItem(item, index);
            notify.success(`Item ${index + 1} restored`);
        });
    };

    const check = () => {
        setChecked(true);
        if (reading.valid) {
            notify.success(`Ready to save · ${reading.summary.itemCount} item${reading.summary.itemCount === 1 ? '' : 's'} · ${formatPrice(reading.summary.total)}`);
            return;
        }
        const parts: string[] = [];
        if (Object.keys(reading.headerErrors).length) parts.push('customer / dates');
        if (reading.items.length === 0) parts.push('no items');
        if (reading.invalidItemNumbers.length) parts.push(`item${reading.invalidItemNumbers.length === 1 ? '' : 's'} ${reading.invalidItemNumbers.join(', ')}`);
        notify.error(`Not ready yet — check ${parts.join(' · ')}`);
        if (reading.headerErrors.customer) document.getElementById('customer')?.focus();
        else itemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const s = reading.summary;
    return (
        <AppLayout title="New Quotation">
            <div className="pb-24 sm:pb-0" data-testid="builder">
                <PageHeader
                    title="New Quotation"
                    description={
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-medium text-warning" data-testid="draft-badge">
                                Draft · Not saved
                            </span>
                            <span aria-hidden="true">·</span>
                            <DraftStatusText status={draftStatus} />
                        </span>
                    }
                    actions={
                        meaningful ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (window.confirm('Discard this draft? Everything entered here will be cleared from this device.')) {
                                        discardCurrent();
                                        notify.info('Draft discarded');
                                    }
                                }}
                                data-testid="discard-draft"
                            >
                                <Trash2 aria-hidden="true" /> Discard draft
                            </Button>
                        ) : null
                    }
                />

                {recovered ? (
                    <InlineAlert
                        tone="warning"
                        title="Recovered unsaved draft"
                        className="mb-4"
                        action={
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        continueDraft();
                                        notify.success('Draft recovered');
                                    }}
                                    data-testid="draft-continue"
                                >
                                    Continue draft
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        if (window.confirm('Discard the recovered draft? It cannot be brought back.')) {
                                            discardRecovered();
                                            notify.info('Recovered draft discarded');
                                        }
                                    }}
                                    data-testid="draft-discard"
                                >
                                    Discard
                                </Button>
                            </div>
                        }
                    >
                        <span data-testid="draft-recovered-summary">
                            {[
                                recovered.quotation.customer.name || 'No customer',
                                `${recovered.quotation.items.length} item${recovered.quotation.items.length === 1 ? '' : 's'}`,
                                `kept ${formatDayFirst(recovered.savedAt.slice(0, 10))} ${timeOf(recovered.savedAt)}`,
                            ].join(' · ')}
                        </span>
                        . It is a local draft on this device, not a saved quotation.
                    </InlineAlert>
                ) : null}

                <div className="flex flex-col gap-5">
                    <CustomerSection
                        quotation={quotation}
                        errors={reading.headerErrors}
                        showErrors={checked}
                        preparedBy={user?.displayName ?? '—'}
                        onCustomer={actions.setCustomer}
                        onHeader={actions.setHeader}
                    />

                    <section ref={itemsRef} aria-labelledby="items-heading" className="flex flex-col gap-3 scroll-mt-20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 id="items-heading" className="text-base font-semibold">
                                Items <span className="font-normal text-muted-foreground">({s.itemCount})</span>
                            </h2>
                        </div>
                        <EntryModes onQuick={openQuick} onManual={openManual} onBatch={openBatch} />
                        {reading.items.length === 0 ? (
                            <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface p-6 text-center text-sm text-muted-foreground" data-testid="builder-empty">
                                No items yet — use <span className="font-medium text-foreground">Manual Add</span> for one item or{' '}
                                <span className="font-medium text-foreground">Batch Add</span> for several similar ones.
                                {checked ? <p className="mt-1 text-danger">Add at least one item.</p> : null}
                            </div>
                        ) : (
                            <ItemsTable
                                items={reading.items}
                                onEdit={(index) => setEditor({ open: true, isNew: false, index, item: quotation.items[index]! })}
                                onDuplicate={(index) => {
                                    actions.duplicate(quotation.items[index]!, index);
                                    notify.success(`Item ${index + 1} duplicated as item ${index + 2}`);
                                }}
                                onMove={(index, dir) => actions.moveItem(quotation.items[index]!.uid, dir)}
                                onRemove={remove}
                            />
                        )}
                    </section>

                    <section aria-labelledby="summary-heading" className="rounded-[var(--radius-lg)] border border-border bg-surface shadow-xs" data-testid="builder-summary">
                        <h2 id="summary-heading" className="sr-only">
                            Summary
                        </h2>
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)] divide-x divide-border sm:grid-cols-3">
                            <div className="px-4 py-3 lg:px-5">
                                <dt className="text-xs text-muted-foreground">Items</dt>
                                <dd className="font-semibold tabular-nums" data-testid="summary-items">
                                    {s.itemCount}
                                </dd>
                            </div>
                            <div className="px-4 py-3 lg:px-5">
                                <dt className="text-xs text-muted-foreground">Total weight</dt>
                                <dd className="text-sm font-semibold whitespace-nowrap tabular-nums sm:text-base" data-testid="summary-weight">
                                    {s.totalWeight > 0 ? `${s.totalWeight.toFixed(3)} kg` : '—'}
                                </dd>
                            </div>
                            <div className="px-4 py-3 text-right lg:px-5">
                                <dt className="text-xs text-muted-foreground">Quotation total</dt>
                                <dd className="text-base font-semibold whitespace-nowrap tabular-nums sm:text-lg" data-testid="summary-total">
                                    {formatPrice(s.total)}
                                </dd>
                            </div>
                        </dl>
                        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button variant="secondary" onClick={check} data-testid="check-quotation">
                                    <ShieldCheck aria-hidden="true" /> Check quotation
                                </Button>
                                <Button variant="primary" disabled aria-describedby="save-note" data-testid="save-quotation">
                                    <Save aria-hidden="true" /> Save quotation
                                </Button>
                                <span id="save-note" className="text-xs text-muted-foreground">
                                    Formal save and the Q-number come with the write path.
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2" data-testid="output-actions">
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Lock className="size-3.5" aria-hidden="true" /> After save:
                                </span>
                                {[
                                    { label: 'Print', icon: Printer },
                                    { label: 'WhatsApp', icon: MessageCircle },
                                    { label: 'Copy', icon: ClipboardCopy },
                                    { label: 'Copy + Weight', icon: ClipboardCopy },
                                ].map(({ label, icon: Icon }) => (
                                    <Button key={label} variant="ghost" size="sm" disabled title="Available after the quotation is saved" data-testid={`output-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
                                        <Icon aria-hidden="true" /> {label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* phone: sticky summary above the bottom navigation (handoff §10) */}
            <div
                className="fixed inset-x-0 bottom-[calc(var(--shell-bottom-nav-height)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-2 backdrop-blur sm:hidden"
                data-testid="builder-sticky"
            >
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm tabular-nums">
                        {s.itemCount} item{s.itemCount === 1 ? '' : 's'} · <span className="font-semibold">{formatPrice(s.total)}</span>
                    </span>
                    <Button variant="secondary" size="sm" onClick={check}>
                        <ShieldCheck aria-hidden="true" /> Check
                    </Button>
                </div>
            </div>

            {editor.open ? (
                <ItemEditor
                    open
                    onOpenChange={(o) => !o && setEditor({ open: false })}
                    initial={editor.item}
                    isNew={editor.isNew}
                    itemNumber={editor.index + 1}
                    onSave={saveFromEditor}
                />
            ) : null}
            <QuickAdd
                open={quickOpen}
                onOpenChange={setQuickOpen}
                onSwitchMode={(m) => {
                    setQuickOpen(false);
                    if (m === 'manual') openManual();
                    else openBatch();
                }}
                onAdd={(items) => {
                    const first = quotation.items.length + 1;
                    actions.addItems(items);
                    setQuickOpen(false);
                    notify.success(items.length === 1 ? `Item ${first} added` : `${items.length} items added (items ${first}–${first + items.length - 1})`);
                }}
            />
            <BatchAdd
                open={batchOpen}
                onOpenChange={setBatchOpen}
                initialProduct={batchProduct}
                onAdd={(items) => {
                    const first = quotation.items.length + 1;
                    actions.addItems(items);
                    setBatchOpen(false);
                    notify.success(items.length === 1 ? `Item ${first} added` : `${items.length} items added (items ${first}–${first + items.length - 1})`);
                }}
            />
        </AppLayout>
    );
}

/* The three entry modes, each named for what it does (never Quick Add ≡ Batch Add). */
function EntryModes({ onQuick, onManual, onBatch }: { onQuick: () => void; onManual: () => void; onBatch: () => void }) {
    const modes = [
        { id: 'open-quick-add', label: 'Quick Add', description: 'AI extract from text, image or PDF', icon: Sparkles, onClick: onQuick },
        { id: 'open-manual-add', label: 'Manual Add', description: 'Enter one item manually', icon: PencilLine, onClick: onManual },
        { id: 'open-batch-add', label: 'Batch Add', description: 'Enter multiple similar items', icon: Layers, onClick: onBatch },
    ];
    return (
        <div className="grid grid-cols-3 gap-2" data-testid="entry-modes">
            {modes.map((m) => (
                <button
                    key={m.id}
                    type="button"
                    onClick={m.onClick}
                    data-testid={m.id}
                    className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface px-2 py-2 text-center shadow-xs hover:border-border-strong hover:bg-surface-muted sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:text-left"
                >
                    <m.icon className="size-5 shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{m.label}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">{m.description}</span>
                    </span>
                </button>
            ))}
        </div>
    );
}
