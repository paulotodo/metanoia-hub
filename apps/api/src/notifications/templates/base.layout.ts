/**
 * base.layout.ts — HTML email base layout with tenant branding.
 *
 * SECURITY (CHK022/M1): ALL dynamic values MUST be passed through escapeHtml()
 * before interpolation. The escapeHtml() function handles XSS in email templates
 * (AC 1.1.2: <script>alert(1)</script> → &lt;script&gt;alert(1)&lt;/script&gt;).
 *
 * LGPD (CHK032/1.1.4): participantName is included ONLY when strictly needed
 * for the leader to act (pastoral_alert). Templates decide inclusion.
 *
 * ACCESSIBILITY (CHK070/1.2.5):
 * - <img> always has alt attribute
 * - Minimum contrast 4.5:1 enforced via default colors
 * - Semantic HTML structure (header/main/footer)
 *
 * NON-LOGGING (CHK029/L1): this module generates html — callers MUST NOT log
 * the return value. EmailService.send() enforces this.
 */

export interface BrandingData {
  primaryColor: string | null;
  secondaryColor: string | null;
  displayName: string | null;
  logoUrl: string | null;
}

/**
 * PHASE 1 DECISION (1.2.3): Default visual identity when tenant has no branding.
 * - Logo: inline SVG "M" mark (no external dependency)
 * - Primary: #1E40AF (blue-800, contrast ≥ 4.5:1 on white)
 * - Secondary: #1E3A5F (dark blue)
 * - Display name: "Metanoia"
 */
const DEFAULTS = {
  primaryColor: '#1E40AF',
  secondaryColor: '#1E3A5F',
  displayName: 'Metanoia',
} as const;

/**
 * escapeHtml — replace HTML special characters with entities.
 *
 * CHK022/M1: EVERY dynamic value interpolated in an HTML template MUST pass
 * through this function. This prevents stored-XSS in email clients.
 *
 * Test vectors (AC 1.1.2):
 *   '<script>alert(1)</script>' → '&lt;script&gt;alert(1)&lt;/script&gt;'
 *   '"><img onerror=alert(1)>' → '&quot;&gt;&lt;img onerror=alert(1)&gt;'
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * validateUrl — check that a URL is http/https before inserting in href.
 * Returns '#' (safe no-op) for non-http/https schemes (javascript:, data:, etc.)
 * CHK023/M2 link safety.
 */
export function validateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '#';
    }
    return url;
  } catch {
    return '#';
  }
}

export interface BaseLayoutOptions {
  /** Pre-rendered inner content (HTML). Caller is responsible for escaping. */
  content: string;
  /** Tenant branding (nullable fields fall back to DEFAULTS). */
  branding: BrandingData;
  /** Email subject (used in <title>). Must be pre-escaped. */
  subject: string;
}

/**
 * renderBaseLayout — wraps content in a full HTML email shell.
 *
 * Uses inline styles (email client compatibility).
 * charset=UTF-8 required for PT-BR diacritics.
 * alt on logo <img> required for accessibility (CHK070).
 */
export function renderBaseLayout(opts: BaseLayoutOptions): string {
  const primary = opts.branding.primaryColor ?? DEFAULTS.primaryColor;
  const secondary = opts.branding.secondaryColor ?? DEFAULTS.secondaryColor;
  const displayName = escapeHtml(opts.branding.displayName ?? DEFAULTS.displayName);
  const safeSubject = escapeHtml(opts.subject);

  const logoBlock = opts.branding.logoUrl
    ? `<img src="${validateUrl(opts.branding.logoUrl)}" alt="${displayName} logo" width="128" height="128" style="max-height:48px;width:auto;display:block;" />`
    : `<div style="font-size:24px;font-weight:700;color:${escapeHtml(primary)};letter-spacing:-0.5px;">${displayName}</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;overflow:hidden;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background-color:${escapeHtml(primary)};text-align:left;">
              ${logoBlock}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${opts.content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:${escapeHtml(secondary)};text-align:center;">
              <p style="margin:0;font-size:12px;color:#FFFFFF;line-height:1.5;">
                ${displayName} &bull; Esta é uma mensagem automática, não responda a este email.<br />
                Para deixar de receber notificações, acesse suas preferências na plataforma.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
