"use client";

import * as React from "react";
import { cn } from "@metanoia/ui";

interface TermsCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  /**
   * Rich label — may include a link to the terms doc, so we accept ReactNode
   * instead of a plain string.
   */
  label: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * LGPD consent checkbox used in 05.2. Native input for accessibility,
 * with a custom box styled via Tailwind. The label is bound via `htmlFor`
 * so the whole label area is clickable.
 */
export function TermsCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  disabled,
  required,
  className,
}: TermsCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 text-sm text-[var(--color-text-primary)]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        required={required}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className={cn(
          "mt-0.5 size-4 shrink-0 rounded border border-[var(--color-border-strong)] text-[var(--color-brand-teal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30",
        )}
      />
      <span>{label}</span>
    </label>
  );
}
