import { CircleAlert, TriangleAlert } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* Compact Builder fields: label, control, and the message right under the
   control (Session E §18 — validation stays next to the field). */

export function Field({
    id,
    label,
    error,
    warning,
    hint,
    required,
    className,
    children,
}: {
    id: string;
    label: ReactNode;
    error?: string | null;
    warning?: string | null;
    hint?: ReactNode;
    required?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1', className)} data-field={id}>
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {label}
                {required ? (
                    <>
                        <span className="ml-0.5 text-danger" aria-hidden="true">
                            *
                        </span>
                        <span className="sr-only"> (required)</span>
                    </>
                ) : null}
            </label>
            {children}
            {error ? (
                <p id={`${id}-error`} role="alert" className="flex items-start gap-1 text-xs text-danger" data-testid={`error-${id}`}>
                    <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </p>
            ) : warning ? (
                <p id={`${id}-error`} className="flex items-start gap-1 text-xs text-warning" data-testid={`warning-${id}`}>
                    <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    <span>{warning}</span>
                </p>
            ) : hint ? (
                <p className="text-xs text-subtle-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

export const controlClass =
    'flex h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base text-foreground shadow-xs transition-colors sm:h-10 sm:text-sm placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input ref={ref} type="text" autoComplete="off" className={cn(controlClass, className)} {...props} />
));
TextInput.displayName = 'TextInput';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(controlClass, 'pr-8', className)} {...props}>
        {children}
    </select>
));
Select.displayName = 'Select';

/** Radio-style segmented choice (Size type, Finish). Selected = weight + border, not colour alone. */
export function Segmented<T extends string>({
    id,
    value,
    options,
    onChange,
    label,
    invalid,
    className,
}: {
    id: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
    label: string;
    invalid?: boolean;
    className?: string;
}) {
    return (
        <div
            id={id}
            role="radiogroup"
            aria-label={label}
            aria-invalid={invalid || undefined}
            className={cn('inline-flex w-full gap-1 rounded-[var(--radius-md)] border border-border bg-surface-muted p-1 sm:w-auto', invalid && 'border-danger', className)}
        >
            {options.map((o) => {
                const on = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'h-9 min-w-14 flex-1 rounded-[var(--radius-sm)] px-3 text-sm whitespace-nowrap sm:h-8 sm:flex-none',
                            on ? 'border border-border-strong bg-surface font-semibold text-foreground shadow-xs' : 'font-medium text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Padded heading for the Builder's full-height sheets (the close button sits top-right). */
export function SheetHeading({ title, description }: { title: string; description?: string }) {
    return (
        <div className="border-b border-border px-4 pt-4 pb-3 pr-14 sm:px-6" aria-hidden="true">
            <p className="text-base font-semibold">{title}</p>
            {description ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p> : null}
        </div>
    );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{children}</h3>
            {aside}
        </div>
    );
}
