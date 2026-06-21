/**
 * safeNavigate — safe same-origin navigation for notification actionUrl.
 * Accepts only relative paths starting with '/'.
 *
 * Rejects (no-op, graceful):
 *   - javascript: URLs
 *   - protocol-relative //evil.com
 *   - absolute external URLs (https://...)
 *   - data: URLs
 *   - empty, null, undefined, malformed
 *
 * OWASP hardening: prevents open-redirect and XSS via metadata.actionUrl.
 */
export function safeNavigate(
  url: string | null | undefined,
  push: (path: string) => void,
): void {
  // Reject anything falsy
  if (!url || typeof url !== 'string') return;

  // Must be a relative path starting with '/', but NOT '//' (protocol-relative)
  if (!url.startsWith('/') || url.startsWith('//')) return;

  // Reject dangerous schemes embedded in the path (defense in depth)
  const lower = url.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return;
  }

  push(url);
}
