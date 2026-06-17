'use client';

import * as React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormFieldBaseProps {
  /** Label text displayed to the user */
  label: string;
  /** Error message; when present triggers aria-invalid + aria-describedby */
  error?: string;
  /** Whether the field is required (injected as aria-required) */
  required?: boolean;
  /** Hint text shown below the input (linked via aria-describedby) */
  hint?: string;
  /** Additional className for the wrapper div */
  className?: string;
  /** Single child: the form control (input, select, textarea, etc.) */
  children: React.ReactElement;
}

interface FormFieldInputProps extends FormFieldBaseProps {
  /** Render as <label>+<div> (default) for single controls */
  as?: 'label';
}

interface FormFieldFieldsetProps extends FormFieldBaseProps {
  /** Render as <fieldset>+<legend> for radio/checkbox groups */
  as: 'fieldset';
}

type FormFieldProps = FormFieldInputProps | FormFieldFieldsetProps;

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * FormField — acessible field wrapper (WCAG 1.3.1, 4.1.3).
 *
 * - Generates stable ids via React.useId() (no manual id prop needed).
 * - Injects id / aria-required / aria-invalid / aria-describedby into child
 *   via React.cloneElement so callers don't have to repeat them.
 * - When `as="fieldset"` wraps in <fieldset>/<legend> (for radiogroup/
 *   checkbox groups).
 * - Links error and hint paragraphs via aria-describedby on the control.
 */
export function FormField({
  label,
  error,
  required = false,
  hint,
  className,
  as: asVariant = 'label',
  children,
}: FormFieldProps) {
  const uid = React.useId();
  const controlId = `ff-${uid}-ctrl`;
  const errorId = `ff-${uid}-error`;
  const hintId = `ff-${uid}-hint`;

  // Build aria-describedby: include hint id first, then error id if present
  const describedByParts: string[] = [];
  if (hint) describedByParts.push(hintId);
  if (error) describedByParts.push(errorId);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  // Clone child, injecting accessibility props.
  // For fieldset variant: do NOT inject aria-required/aria-invalid on the child
  // (the fieldset/legend communicate required visually; injecting on a <div>
  // would trigger axe aria-allowed-attr violation).
  const ariaProps =
    asVariant === 'fieldset'
      ? {}
      : {
          'aria-required': required || undefined,
          'aria-invalid': error ? (true as unknown as boolean) : undefined,
          'aria-describedby':
            describedBy ??
            (children.props as Record<string, unknown>)['aria-describedby'],
        };

  const enhancedChild = React.cloneElement(children, {
    id: (children.props as Record<string, unknown>).id ?? controlId,
    ...ariaProps,
  } as Partial<React.HTMLAttributes<HTMLElement>>);

  // Shared error + hint markup
  const errorNode = error ? (
    <p id={errorId} role="alert" className="mt-1 text-sm text-state-danger">
      {error}
    </p>
  ) : null;

  const hintNode = hint ? (
    <p id={hintId} className="mt-1 text-sm text-text-tertiary">
      {hint}
    </p>
  ) : null;

  if (asVariant === 'fieldset') {
    return (
      <fieldset className={className}>
        <legend className="mb-1 text-sm font-medium text-text-primary">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-state-danger">
              *
            </span>
          )}
        </legend>
        {hintNode}
        {enhancedChild}
        {errorNode}
      </fieldset>
    );
  }

  const effectiveId =
    ((children.props as Record<string, unknown>).id as string | undefined) ?? controlId;

  return (
    <div className={className}>
      <label htmlFor={effectiveId} className="mb-1 block text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-state-danger">
            *
          </span>
        )}
      </label>
      {hintNode}
      {enhancedChild}
      {errorNode}
    </div>
  );
}
