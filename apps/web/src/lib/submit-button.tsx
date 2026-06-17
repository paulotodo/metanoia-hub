'use client';

import * as React from 'react';
import { Button } from '@metanoia/ui';

// ─── SubmitButton ─────────────────────────────────────────────────────────────

type ButtonHTMLAttrs = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled'
>;

export interface SubmitButtonProps extends ButtonHTMLAttrs {
  /** Label shown when button is idle */
  label: string;
  /** Label shown when submission is in progress (dec-025: pendingLabel, not labelPending) */
  pendingLabel: string;
  /** When true: button disabled + aria-busy + shows pendingLabel with spinner */
  isPending: boolean;
}

/**
 * SubmitButton — accessible form submit button.
 *
 * - aria-busy={true} during pending state (WCAG 4.1.3).
 * - Spinner wrapped in aria-hidden="true" so screen readers skip it.
 * - Transition pending→error (dec-028): when parent sets isPending=false,
 *   re-renders without aria-busy/disabled automatically.
 * - Uses @metanoia/ui Button for consistent styling.
 */
export function SubmitButton({
  label,
  pendingLabel,
  isPending,
  className,
  ...rest
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={isPending}
      aria-busy={isPending || undefined}
      className={className}
      {...rest}
    >
      {isPending ? (
        <>
          <span aria-hidden="true" className="mr-1.5 inline-block animate-spin">
            ⟳
          </span>
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
