import { Link } from '@inertiajs/react';
import { Building2, ExternalLink, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatDayFirst, parseDayFirst } from '@/builder/dates';
import type { CustomerDraft, DraftQuotation } from '@/builder/model';
import type { HeaderField } from '@/builder/quotation';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboOption } from './combobox';
import { Field, TextInput, controlClass } from './fields';

/* Quotation header (handoff §6): customer search / selected customer card,
   quotation-specific contact & phone, day-first dates, Prepared By as
   read-only system metadata (never an input), optional remarks.
   Customer search uses the existing read-only company directory; Smart
   Search / Price Lookup is Session F. */

interface CompanyHit {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
    quotationCount: number;
    lastQuotedDate: string | null;
    matchedBy: 'name' | 'alias' | 'phone' | null;
}

function useCompanySearch(query: string, enabled: boolean) {
    const [hits, setHits] = useState<CompanyHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    useEffect(() => {
        const q = query.trim();
        if (!enabled || q.length < 1) {
            setHits([]);
            setLoading(false);
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        const t = window.setTimeout(() => {
            fetch(`/quotations/new/customers?q=${encodeURIComponent(q)}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
                signal: ctrl.signal,
            })
                .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
                .then((data: { source: string; companies: CompanyHit[] }) => {
                    setHits(data.companies ?? []);
                    setUnavailable(data.source !== 'connected');
                })
                .catch((e: unknown) => {
                    if ((e as Error).name !== 'AbortError') {
                        setHits([]);
                        setUnavailable(true);
                    }
                })
                .finally(() => setLoading(false));
        }, 250);
        return () => {
            window.clearTimeout(t);
            ctrl.abort();
        };
    }, [query, enabled]);
    return { hits, loading, unavailable };
}

function DayFirstDate({ id, label, value, onChange, error, required }: { id: string; label: string; value: string; onChange: (iso: string) => void; error?: string; required?: boolean }) {
    const [text, setText] = useState(formatDayFirst(value));
    const [bad, setBad] = useState(false);
    const last = useRef(value);
    useEffect(() => {
        if (value !== last.current) {
            setText(formatDayFirst(value));
            setBad(false);
            last.current = value;
        }
    }, [value]);
    const commit = (t: string) => {
        if (!t.trim()) {
            setBad(false);
            last.current = '';
            onChange('');
            return;
        }
        const iso = parseDayFirst(t);
        setBad(iso === null);
        if (iso) {
            last.current = iso;
            setText(formatDayFirst(iso));
            onChange(iso);
        }
    };
    const msg = bad ? 'Use DD-MM-YYYY' : error;
    return (
        <Field id={id} label={label} required={required} error={msg} hint="DD-MM-YYYY">
            <TextInput
                id={id}
                inputMode="numeric"
                placeholder="DD-MM-YYYY"
                value={text}
                aria-invalid={msg ? true : undefined}
                aria-describedby={msg ? `${id}-error` : undefined}
                onChange={(e) => setText(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit((e.target as HTMLInputElement).value);
                    }
                }}
            />
        </Field>
    );
}

export function CustomerSection({
    quotation,
    errors,
    showErrors,
    preparedBy,
    onCustomer,
    onHeader,
}: {
    quotation: DraftQuotation;
    errors: Partial<Record<HeaderField, string>>;
    showErrors: boolean;
    preparedBy: string;
    onCustomer: (patch: Partial<CustomerDraft>) => void;
    onHeader: (patch: Partial<Pick<DraftQuotation, 'quoteDate' | 'validUntil' | 'remarks'>>) => void;
}) {
    const c = quotation.customer;
    const selected = c.companyId !== null;
    const { hits, loading, unavailable } = useCompanySearch(c.name, !selected);
    const options: ComboOption[] = hits.map((h) => ({
        value: String(h.id),
        label: h.name,
        description: [h.phone, `${h.quotationCount} quotation${h.quotationCount === 1 ? '' : 's'}`, h.matchedBy === 'alias' ? 'matched a legacy code' : null]
            .filter(Boolean)
            .join(' · '),
    }));
    const customerError = showErrors ? errors.customer : undefined;

    return (
        <section aria-labelledby="customer-heading" className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs sm:p-5" data-testid="customer-section">
            <h2 id="customer-heading" className="sr-only">
                Customer
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                    {selected ? (
                        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface-muted/50 p-3" data-testid="customer-card">
                            <Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-muted-foreground">Customer</p>
                                <p className="truncate font-semibold" data-testid="customer-name">
                                    {c.name}
                                </p>
                                {c.address ? <p className="mt-0.5 text-sm whitespace-pre-line text-muted-foreground">{c.address}</p> : null}
                                <Link href={`/companies/${c.companyId}`} className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                                    Open company <ExternalLink className="size-3" aria-hidden="true" />
                                </Link>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => onCustomer({ companyId: null, name: '', phone: '', address: '' })}
                                data-testid="customer-change"
                            >
                                <X aria-hidden="true" /> Change
                            </Button>
                        </div>
                    ) : (
                        <Field
                            id="customer"
                            label="Customer"
                            required
                            error={customerError}
                            hint={unavailable ? 'Customer directory unavailable — the typed name is used' : 'Search the directory, or type a new customer name'}
                        >
                            <Combobox
                                id="customer"
                                value={c.name}
                                onChange={(name) => onCustomer({ name, companyId: null })}
                                onSelect={(o) => {
                                    const hit = hits.find((h) => String(h.id) === o.value);
                                    if (hit) onCustomer({ companyId: hit.id, name: hit.name, phone: c.phone || hit.phone || '', address: hit.address ?? '' });
                                }}
                                options={options}
                                filter={false}
                                loading={loading}
                                emptyText={c.name.trim() ? `No directory match — “${c.name.trim()}” will be used as typed` : undefined}
                                placeholder="Company name or phone"
                                aria-invalid={customerError ? true : undefined}
                                aria-describedby={customerError ? 'customer-error' : undefined}
                                testId="customer-combobox"
                            />
                        </Field>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="contact" label="Contact" hint="For this quotation">
                            <TextInput id="contact" value={c.contact} onChange={(e) => onCustomer({ contact: e.target.value })} />
                        </Field>
                        <Field id="phone" label="Phone" hint={selected ? 'From the company; edit for this quotation' : undefined}>
                            <TextInput id="phone" inputMode="tel" value={c.phone} onChange={(e) => onCustomer({ phone: e.target.value })} />
                        </Field>
                    </div>
                </div>
                <div className="grid content-start gap-3 sm:grid-cols-2">
                    <DayFirstDate id="quoteDate" label="Quotation date" required value={quotation.quoteDate} onChange={(quoteDate) => onHeader({ quoteDate })} error={showErrors ? errors.quoteDate : undefined} />
                    <DayFirstDate id="validUntil" label="Valid until" value={quotation.validUntil} onChange={(validUntil) => onHeader({ validUntil })} error={errors.validUntil} />
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Prepared by</span>
                        <span className="flex h-10 items-center text-sm font-medium" data-testid="prepared-by">
                            {preparedBy}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">Quotation no.</span>
                        <span className="flex h-10 items-center text-sm text-warning" data-testid="quotation-no">
                            Draft · Not saved
                        </span>
                    </div>
                </div>
            </div>
            <details className="mt-3" open={quotation.remarks.trim() !== '' || undefined}>
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Remarks (optional)</summary>
                <textarea
                    id="remarks"
                    aria-label="Remarks"
                    rows={2}
                    value={quotation.remarks}
                    onChange={(e) => onHeader({ remarks: e.target.value })}
                    className={`${controlClass} mt-2 h-auto py-2`}
                />
            </details>
        </section>
    );
}
