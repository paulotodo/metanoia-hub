/**
 * password-recovery.template.ts — password reset e-mail.
 *
 * Mirrors email-verification.template: the recipient is not scoped to a tenant
 * at reset time, so NO_BRANDING falls back to the Metanoia defaults.
 *
 * SECURITY: firstName escaped via escapeHtml(); resetUrl validated (http/https)
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

export interface PasswordRecoveryInput {
  /** Recipient first name — escaped. */
  firstName: string;
  /** Absolute reset URL (validated; goes in href). */
  resetUrl: string;
}

export function renderPasswordRecovery(
  opts: PasswordRecoveryInput,
): EmailTemplateResult {
  const safeName = escapeHtml(opts.firstName);
  const safeUrl = validateUrl(opts.resetUrl);

  const subject = '[Metanoia] Redefinição de senha';

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Redefinição de senha
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
      Olá, ${safeName}! Recebemos um pedido para redefinir a senha da sua conta.
      Clique no botão abaixo para criar uma senha nova.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-radius:6px;background-color:#1E40AF;">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:6px;">
            Criar senha nova
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
      Este link expira em 15 minutos. Se você não pediu para trocar a senha, pode
      ignorar esta mensagem — sua senha atual continua valendo.
    </p>
  `;

  return {
    subject,
    html: renderBaseLayout({ content, branding: NO_BRANDING, subject }),
  };
}
