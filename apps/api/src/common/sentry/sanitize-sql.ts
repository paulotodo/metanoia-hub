/**
 * sanitize-sql.ts — Sanitize db.statement to prevent PII leakage (OWASP M1)
 *
 * Spec §FR-05, plan §3 rules 1-4, checklist CHK041/CHK042.
 *
 * Strategy: allowlist fail-closed.
 * - Model operations: only "model.operation" string (no args, no data)
 * - Raw queries: apply conservative regex to strip literals; if uncertain → omit (return undefined)
 *
 * NEVER serialize query args or bind parameters — they contain user data.
 */

/** Regex patterns that remove SQL literals potentially containing PII */
const LITERAL_PATTERNS: RegExp[] = [
  // Single-quoted strings: 'value', E'value', 'it''s'
  /E?'(?:[^'\\]|\\.|\\'|'')*'/gi,
  // Dollar-quoted strings: $tag$....$tag$ and $$..$$ (PostgreSQL)
  /\$([^$]*)\$[\s\S]*?\$\1\$/gi,
  // Positional params: $1, $2, ...$N
  /\$\d+/g,
  // Numeric literals (standalone numbers, not inside identifiers)
  /\b\d+(?:\.\d+)?\b/g,
  // Array literals: ARRAY[...], {...}
  /ARRAY\[[^\]]*\]/gi,
  /\{[^}]*\}/g,
];

const REDACTED = '?';

/**
 * Sanitize a Prisma db.statement for OTel span attribute.
 *
 * @param model     - Prisma model name (undefined for raw queries)
 * @param operation - Prisma operation name (e.g. 'findMany', 'create', 'queryRaw')
 * @param isRaw     - true when this is a $queryRaw / $executeRaw call
 * @returns sanitized string for span attribute, or undefined to omit the attribute
 */
export function sanitizeStatement(
  model: string | undefined,
  operation: string,
  isRaw: boolean,
): string | undefined {
  // Model operations: safe to expose "model.operation" — no data attached
  if (!isRaw && model) {
    return `${model}.${operation}`;
  }

  // Raw queries without model (e.g. SET LOCAL, SELECT 1)
  // We don't have the raw SQL string here at the extension level — return operation only.
  // The caller (FASE 4) passes the raw SQL separately if needed.
  return operation ?? undefined;
}

/**
 * Sanitize a raw SQL string by replacing literal values with '?'.
 * Returns undefined (omit attribute) if sanitization produces empty result or
 * if the input is suspicious (too short after scrubbing).
 *
 * @param rawSql - the raw SQL string from the query
 */
export function sanitizeRawSql(rawSql: string): string | undefined {
  if (!rawSql || typeof rawSql !== 'string') return undefined;

  let sanitized = rawSql;
  for (const pattern of LITERAL_PATTERNS) {
    sanitized = sanitized.replace(pattern, REDACTED);
  }

  // Collapse consecutive ? placeholders
  sanitized = sanitized.replace(/(\?\s*,\s*)+\?/g, '?, ...');

  // If result is empty or only whitespace/punctuation, omit — fail-closed
  const stripped = sanitized.replace(/[\s?,.;()]/g, '');
  if (stripped.length === 0) return undefined;

  return sanitized.trim();
}
