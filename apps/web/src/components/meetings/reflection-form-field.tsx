"use client";

import { forwardRef, useEffect, useRef } from "react";

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
}

export const ReflectionFormField = forwardRef<
  HTMLTextAreaElement,
  ReflectionFormFieldProps
>(function ReflectionFormField(
  { label, counterTemplate, errorId, invalid, value = "", autoFocus, ...rest },
  ref,
) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const remaining = Math.max(0, MAX - (value?.length ?? 0));
  const counterId = "reflection-counter";

  useEffect(() => {
    if (autoFocus && localRef.current) {
      localRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className="space-y-2">
      <label
        htmlFor="reflection-text"
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
      </label>
      <textarea
        id="reflection-text"
        ref={(el) => {
          localRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        rows={4}
        maxLength={MAX}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={[counterId, errorId].filter(Boolean).join(" ") || undefined}
        className="w-full rounded-lg border border-surface-muted bg-surface px-3 py-2 text-base text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus aria-[invalid=true]:border-state-danger"
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
