import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* Searchable combobox (handoff §12: no native <datalist>). Free text is always
   allowed — options only assist. Keyboard: ↓/↑ move, Enter picks the active
   option, Escape closes; picking with the mouse never blurs the input first.
   ARIA 1.2 combobox pattern: input[role=combobox] + listbox. */

export interface ComboOption {
    value: string;
    label: string;
    description?: string;
}

export interface ComboboxProps {
    id: string;
    value: string;
    onChange: (text: string) => void;
    onSelect?: (option: ComboOption) => void;
    onCommit?: (text: string) => void;
    options: ComboOption[];
    /** Filter options by the typed text (false when the caller already filtered, e.g. async search). */
    filter?: boolean;
    placeholder?: string;
    emptyText?: string;
    loading?: boolean;
    inputMode?: 'text' | 'search' | 'decimal';
    className?: string;
    inputClassName?: string;
    'aria-invalid'?: true | undefined;
    'aria-describedby'?: string | undefined;
    'aria-label'?: string;
    /** Rendered under the input (interpretation label etc.). */
    after?: ReactNode;
    testId?: string;
    maxOptions?: number;
}

const norm = (s: string) => s.toUpperCase().replace(/[\s"”″]+/g, '');

export function Combobox({
    id,
    value,
    onChange,
    onSelect,
    onCommit,
    options,
    filter = true,
    placeholder,
    emptyText,
    loading = false,
    inputMode = 'text',
    className,
    inputClassName,
    after,
    testId,
    maxOptions = 12,
    ...aria
}: ComboboxProps) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    const shown = useMemo(() => {
        if (!filter) return options.slice(0, maxOptions);
        const q = norm(value);
        if (!q) return options.slice(0, maxOptions);
        const starts = options.filter((o) => norm(o.label).startsWith(q) || norm(o.value).startsWith(q));
        const contains = options.filter((o) => !starts.includes(o) && (norm(o.label).includes(q) || norm(o.value).includes(q)));
        return [...starts, ...contains].slice(0, maxOptions);
    }, [options, value, filter, maxOptions]);

    useEffect(() => setActive(-1), [value, open]);

    const pick = (o: ComboOption) => {
        onSelect ? onSelect(o) : onChange(o.value);
        setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(shown.length - 1, a + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
        } else if (e.key === 'Enter') {
            if (open && active >= 0 && shown[active]) {
                e.preventDefault();
                pick(shown[active]!);
            } else {
                onCommit?.(value);
                setOpen(false);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
            }
        }
    };

    const showList = open && (shown.length > 0 || loading || !!emptyText);
    return (
        <div className={cn('relative', className)} data-testid={testId}>
            <input
                ref={inputRef}
                id={id}
                type="text"
                role="combobox"
                autoComplete="off"
                spellCheck={false}
                inputMode={inputMode}
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
                value={value}
                placeholder={placeholder}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                    setOpen(false);
                    onCommit?.(value);
                }}
                onKeyDown={onKeyDown}
                className={cn(
                    'flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base text-foreground shadow-xs transition-colors sm:h-10 sm:text-sm',
                    'placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none',
                    'aria-[invalid=true]:border-danger',
                    inputClassName,
                )}
                {...aria}
            />
            {showList ? (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-40 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface py-1 shadow-lg"
                >
                    {loading ? <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li> : null}
                    {!loading && shown.length === 0 && emptyText ? <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li> : null}
                    {shown.map((o, i) => (
                        <li
                            key={`${o.value}-${i}`}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                pick(o);
                            }}
                            onMouseEnter={() => setActive(i)}
                            className={cn('cursor-pointer px-3 py-2 text-sm', i === active ? 'bg-accent-soft text-foreground' : 'text-foreground hover:bg-surface-muted')}
                        >
                            <span className="font-medium">{o.label}</span>
                            {o.description ? <span className="block truncate text-xs text-muted-foreground">{o.description}</span> : null}
                        </li>
                    ))}
                </ul>
            ) : null}
            {after}
        </div>
    );
}
