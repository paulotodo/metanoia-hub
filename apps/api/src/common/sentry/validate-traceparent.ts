/**
 * validate-traceparent.ts — Validate W3C traceparent header (OWASP M3)
 *
 * Spec: https://www.w3.org/TR/trace-context/#traceparent-header
 * Format: 00-<traceId:32hex>-<parentId:16hex>-<flags:2hex>
 *
 * Checklist CHK044/CHK037. Called BEFORE propagation.extract() to prevent
 * accepting malformed/adversarial trace context from external sources.
 */

/**
 * W3C traceparent regex (version 00 only, as per current spec).
 * - version:  2 hex chars = '00'
 * - traceId:  32 hex chars (must not be all-zeros)
 * - parentId: 16 hex chars (must not be all-zeros)
 * - flags:    2 hex chars
 */
const TRACEPARENT_REGEX = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

/** All-zero traceId is invalid per W3C spec */
const ZERO_TRACE_ID = '0'.repeat(32);
/** All-zero parentId is invalid per W3C spec */
const ZERO_PARENT_ID = '0'.repeat(16);

/**
 * Validate a W3C traceparent value.
 *
 * @param value - the raw value to validate (may be any type from untrusted input)
 * @returns true if value is a valid W3C traceparent string
 */
export function validateTraceparent(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!TRACEPARENT_REGEX.test(value)) return false;

  const parts = value.split('-');
  // parts: ['00', traceId, parentId, flags]
  const traceId = parts[1];
  const parentId = parts[2];

  // Reject all-zero IDs (invalid per spec)
  if (traceId === ZERO_TRACE_ID) return false;
  if (parentId === ZERO_PARENT_ID) return false;

  return true;
}
