"use client";

import { forwardRef, useEffect, useId, useRef } from "react";

const MAX = 280;

interface ReflectionFormFieldProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "maxLength" | "aria-describedby"
  > {
  label: string;
  counterTemplate: string;
  errorId?: string;
  invalid?: boolean;
  value?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export const ReflectionFormField = forwardRef<
  HTMLTextAreaElement,
  ReflectionFormFieldProps
>(function ReflectionFormField(
  { label, counterTemplate, errorId, invalid, value = "", autoFocus, required, ...rest },
  ref,
) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const remaining = Math.max(0, MAX - (value?.length ?? 0));
  const fieldId = useId();
  const counterId = `${fieldId}-counter`;

  useEffect(() => {
    if (autoFocus && localRef.current) {
      localRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
        {required && <span aria-hidden="true" className="ml-0.5 text-state-danger">*</span>}
      </label>
      <textarea
        id={fieldId}
        ref={(el) => {
          localRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        rows={4}
        maxLength={MAX}
        aria-invalid={invalid ? true : undefined}
        aria-required={required ? true : undefined}
        aria-describedby={[counterId, errorId].filter(Boolean).join(" ") || undefined}
        className="w-full rounded-lg border border-surface-muted bg-surface px-3 py-2 text-base text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 aria-[invalid=true]:border-state-danger"
        value={value}
        {...rest}
      />
      <p
        id={counterId}
        data-testid="reflection-counter"
        className="text-right text-xs text-text-muted"
      >
        {counterTemplate.replace("{remaining}", String(remaining))}
      </p>
    </div>
  );
});
