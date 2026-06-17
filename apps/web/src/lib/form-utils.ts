// form-utils.ts — utilitários de formulário acessíveis (sem dependência React)

// ─── scrollToFirstError ───────────────────────────────────────────────────────

/**
 * Scroll to the first element with aria-invalid="true" in DOM order,
 * then focus it. No-op if no invalid field is found.
 *
 * Uses DOM order (WCAG 1.3.2 — meaningful sequence).
 * dec-027: document.querySelector returns the FIRST match in DOM order.
 */
export function scrollToFirstError(): void {
  const el = document.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();
}
