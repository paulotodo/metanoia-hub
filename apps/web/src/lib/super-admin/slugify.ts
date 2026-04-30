const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/**
 * Convert a free-form church name into a kebab-case slug. Matches the regex
 * enforced by `ProvisionTenantInputSchema` on the server.
 *
 *   slugify("Igreja Restauração")  → "igreja-restauracao"
 *   slugify("Comunidade @Esperança 2!") → "comunidade-esperanca-2"
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
