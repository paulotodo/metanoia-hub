/**
 * export-ready.template.ts — Email template for completed data exports.
 *
 * spec.md §P3 AC: file is NOT attached to the email — only the signed download URL.
 * URL validity: 1 hour (signed URL generated at notification dispatch time).
 * L1/CHK029: signedUrl NEVER appears in logs. EmailService.send() enforces this.
 *
 * 1.2.6 Subject: [Metanoia] Arquivo pronto
 * 4.4.3: Long URLs (800+ chars) must NOT be truncated in HTML.
 */
import { renderBaseLayout, escapeHtml, validateUrl, type BrandingData } from './base.layout';
import type { EmailTemplateResult } from './pastoral-alert.template';

export interface ExportReadyInput {
  /** Report/export title — escaped. */
  reportTitle: string;
  /**
   * Signed download URL (may be 800+ chars).
   * SECURITY: validated (http/https only). NEVER logged.
   */
  downloadUrl: string;
  /** Human-readable expiry (e.g., "21 de junho de 2026, 16:00") — escaped. */
  expiresAt: string;
  /** Tenant branding. */
  branding: BrandingData;
}

export function renderExportReady(opts: ExportReadyInput): EmailTemplateResult {
  const safeTitle = escapeHtml(opts.reportTitle);
  const safeExpiry = escapeHtml(opts.expiresAt);
  // URL validated but NOT escaped (it goes in href, not text content)
  // validateUrl ensures http/https scheme only (CHK023/M2)
  const safeUrl = validateUrl(opts.downloadUrl);

  const subject = '[Metanoia] Arquivo pronto';

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Seu arquivo está pronto
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
      A exportação que você solicitou foi concluída com sucesso.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#F0FDF4;border-left:4px solid #16A34A;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Relatório</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${safeTitle}</p>
          <p style="margin:0;font-size:13px;color:#DC2626;">
            ⏳ Link válido até: <strong>${safeExpiry}</strong>
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6;">
      O link de download expira em 1 hora. Faça o download antes que ele expire.
      Arquivos não são enviados em anexo por segurança.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:6px;background-color:#16A34A;">
          <a href="${safeUrl}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
            Baixar arquivo →
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderBaseLayout({ content, branding: opts.branding, subject });
  return { subject, html };
}
