"use client";

import * as React from "react";
import { Input, cn } from "@metanoia/ui";

interface PasswordInputWithToggleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Aria label shown when the password is currently hidden. */
  toggleShowLabel: string;
  /** Aria label shown when the password is currently visible. */
  toggleHideLabel: string;
  containerClassName?: string;
  /** Optional data-testid applied to the toggle button (not the input). */
  toggleTestId?: string;
}

/**
 * Password field with a visibility toggle (spec 05.3).
 * - Uses the shared @metanoia/ui Input so focus ring / spacing stay consistent.
 * - Toggle state is internal — the parent only receives the value via onChange.
 */
export const PasswordInputWithToggle = React.forwardRef<
  HTMLInputElement,
  PasswordInputWithToggleProps
>(function PasswordInputWithToggle(
  {
    toggleShowLabel,
    toggleHideLabel,
    containerClassName,
    className,
    toggleTestId,
    ...props
  },
  ref,
) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={cn("relative", containerClassName)}>
      <Input
        {...props}
        ref={ref}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? toggleHideLabel : toggleShowLabel}
        aria-pressed={visible}
        data-testid={toggleTestId}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-text-muted)] transition-opacity hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/30 active:opacity-70"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
});

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      <path d="m2 2 20 20" />
      <path d="M6.71 6.71C3.4 8.79 2 12 2 12s3 7 10 7c2.18 0 4.05-.68 5.58-1.64" />
      <path d="M9.88 4.24A10.6 10.6 0 0 1 12 4c7 0 10 7 10 7a13.2 13.2 0 0 1-2.17 3.17" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}
