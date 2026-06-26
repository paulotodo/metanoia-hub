/**
 * hasInvalidImgs — synchronous parser for <img> tags without alt text in HTML content.
 * Detects: img tag without alt attribute, or with alt="" (empty string), or alt= with no value.
 * Synchronous (boolean) per FR-012 and CA-005.1 (immediate consistency requirement).
 *
 * Returns true if there is ≥1 <img> tag without a non-empty alt attribute in the HTML.
 * Returns false for null/undefined/empty input (CA-005.3).
 */
export function hasInvalidImgs(html: string | null | undefined): boolean {
  if (!html) return false;

  // Regex: match each <img ...> tag
  const imgTagRegex = /<img\b[^>]*>/gi;
  // Regex: alt attribute with a non-empty value (double quotes or single quotes only).
  // Unquoted alt is unusual in practice and excluded to avoid false negatives with
  // self-closing tags like alt= /> where "/" would be misread as a value.
  const altWithValueRegex = /\balt\s*=\s*(?:"[^"]+"|'[^']+')/i;

  let match: RegExpExecArray | null;
  while ((match = imgTagRegex.exec(html)) !== null) {
    if (!altWithValueRegex.test(match[0])) {
      return true;
    }
  }
  return false;
}

/** @deprecated Use hasInvalidImgs directly — class wrapper retained for migration compatibility */
export const AltTextValidator = { hasInvalidImgs };
