import { CircleAlert } from 'lucide-react';
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* Presentation-only validation pattern (handoff §3 "inline validation").
   Validation RULES live with the domain / server; this only shows a message
   that the caller already has, and wires aria-invalid / aria-describedby. */

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
    if (!children) return null;
    return (
        <p id={id} role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

export interface FormFieldControlProps {
    id: string;
    'aria-invalid': true | undefined;
    'aria-describedby': string | undefined;
}

export function FormField({
    id,
    label,
    hint,
    error,
    required,
    className,
    children,
}: {
    id: string;
    label: string;
    hint?: React.ReactNode;
    error?: string | null;
    required?: boolean;
    className?: string;
    /** Render-prop receives the aria wiring for the control. */
    children: (control: FormFieldControlProps) => React.ReactNode;
}) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label htmlFor={id}>
                {label}
                {required ? (
                    <span className="ml-0.5 text-danger" aria-hidden="true">
                        *
                    </span>
                ) : null}
                {required ? <span className="sr-only"> (required)</span> : null}
            </Label>
            {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
            {hint ? (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            ) : null}
            <FieldError id={errorId}>{error}</FieldError>
        </div>
    );
}
