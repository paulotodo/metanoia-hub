/**
 * email-verification.template.ts — registration confirmation e-mail.
 *
 * Sent before the user belongs to any tenant, so there is no tenant branding:
 * NO_BRANDING falls back to the Metanoia defaults in base.layout.
 *
 * SECURITY: firstName escaped via escapeHtml(); verifyUrl validated (http/https)
 * via validateUrl(). L1/CHK029: the resulting html is NEVER logged.
 */
import {
  renderBaseLayout,
  escapeHtml,
  validateUrl,
  type BrandingData,
} from './base.layout';
import type { EmailTemplateResult } from './pastoral-alert.template';

const NO_BRANDING: BrandingData = {
  primaryColor: null,
  secondaryColor: null,
  displayName: null,
  logoUrl: null,
};

export interface EmailVerificationInput {
  /** Recipient first name — escaped. */
  firstName: string;
  /** Absolute confirmation URL (validated; goes in href). */
  verifyUrl: string;
}

export function renderEmailVerification(
  opts: EmailVerificationInput,
): EmailTemplateResult {
  const safeName = escapeHtml(opts.firstName);
  const safeUrl = validateUrl(opts.verifyUrl);

  const subject = '[Metanoia] Confirme seu e-mail';

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Confirme seu e-mail
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
      Olá, ${safeName}! Que bom ter você aqui. Para ativar sua conta e começar a
      caminhar com a gente, confirme seu e-mail no botão abaixo.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:6px;background-color:#1E40AF;">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:6px;">
            Confirmar e-mail
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;color:#6B7280;line-height:1.6;">
      Se o botão não funcionar, copie e cole este endereço no navegador:
    </p>
    <p style="margin:0 0 24px;font-size:13px;color:#1E40AF;word-break:break-all;">
      ${safeUrl}
    </p>
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
      Este link expira em 24 horas. Se você não criou esta conta, pode ignorar
      esta mensagem com tranquilidade.
    </p>
  `;

  return {
    subject,
    html: renderBaseLayout({ content, branding: NO_BRANDING, subject }),
  };
}
