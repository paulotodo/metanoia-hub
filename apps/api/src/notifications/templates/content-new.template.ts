/**
 * content-new.template.ts — Email template for new trail/content availability.
 *
 * 1.2.6 Subject: [Metanoia] Nova trilha disponível
 * 1.2.1 PT-BR vocabulary: "Trilha de formação" (trail), "disponível" (available)
 *
 * NOTE on deferral (spec.md §FR-10/P5): content_new is deferrable when rate
 * limit >= 80. Deferred notifications get metadata.deferredUntil; no immediate fallback.
 */
import { renderBaseLayout, escapeHtml, validateUrl, type BrandingData } from './base.layout';
import type { EmailTemplateResult } from './pastoral-alert.template';

export interface ContentNewInput {
  /** Trail title — escaped. */
  trailTitle: string;
  /** Short description of the trail — escaped. */
  trailDescription: string;
  /** URL to access the trail — validated. */
  trailUrl: string;
  /** Tenant branding. */
  branding: BrandingData;
}

export function renderContentNew(opts: ContentNewInput): EmailTemplateResult {
  const safeTitle = escapeHtml(opts.trailTitle);
  const safeDesc = escapeHtml(opts.trailDescription);
  const safeUrl = validateUrl(opts.trailUrl);

  const subject = '[Metanoia] Nova trilha disponível';

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Nova trilha de formação disponível
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
      Uma nova trilha foi adicionada à plataforma para você.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#F5F3FF;border-left:4px solid #7C3AED;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Trilha</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${safeTitle}</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.5;">${safeDesc}</p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:6px;background-color:#7C3AED;">
          <a href="${safeUrl}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
            Acessar trilha →
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderBaseLayout({ content, branding: opts.branding, subject });
  return { subject, html };
}
