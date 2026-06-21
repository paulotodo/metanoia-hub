/**
 * pastoral-alert.template.ts — Email template for pastoral risk alerts.
 *
 * PHASE 1 DECISIONS:
 * 1.2.1 PT-BR pastoral vocabulary: "Sinal de cuidado" (not "alerta de risco")
 * 1.2.2 Mandatory content: participantName, riskReason, groupName, CTA to radar
 * 1.2.6 Subject convention: [Metanoia] Sinal de cuidado: <groupName>
 * 1.1.4 LGPD: participantName included — necessary for leader to act pastorally.
 *        Decision: minimal use, name only (no contact details, no behavior data in email).
 *
 * CHK023/M1: ALL dynamic fields pass through escapeHtml().
 * CHK022: radarUrl validated before href insertion.
 */
import { renderBaseLayout, escapeHtml, validateUrl, type BrandingData } from './base.layout';

export interface PastoralAlertInput {
  /** Name of the participant needing pastoral care. Escaped before rendering. */
  participantName: string;
  /** Reason for the alert (e.g., "Ausência por 3 semanas"). Escaped before rendering. */
  riskReason: string;
  /** Group name. Escaped before rendering. */
  groupName: string;
  /** URL to the Pastoral Radar dashboard for this participant. Validated before href. */
  radarUrl: string;
  /** Tenant branding for header/footer. */
  branding: BrandingData;
}

export interface EmailTemplateResult {
  subject: string;
  html: string;
}

/**
 * renderPastoralAlert — generates the email for a pastoral risk signal.
 *
 * CHK050/SC-01: pastoral_alert is critical — delivered within ~1 min.
 * Retry config: EMAIL_CRITICAL_BACKOFF_MS=5s × 3 attempts = max 15s.
 */
export function renderPastoralAlert(opts: PastoralAlertInput): EmailTemplateResult {
  // CHK023/M1: escape all dynamic values
  const safeName = escapeHtml(opts.participantName);
  const safeReason = escapeHtml(opts.riskReason);
  const safeGroup = escapeHtml(opts.groupName);
  const safeUrl = validateUrl(opts.radarUrl);

  // 1.2.6 subject convention
  const subject = `[Metanoia] Sinal de cuidado: ${opts.groupName}`;

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Sinal de cuidado identificado
    </h1>
    <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.6;">
      Um membro do seu grupo precisa de atenção pastoral.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#FEF2F2;border-left:4px solid #DC2626;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:14px;color:#991B1B;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Participante</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${safeName}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Grupo: <strong>${safeGroup}</strong></p>
          <p style="margin:0;font-size:14px;color:#6B7280;">Motivo: <strong>${safeReason}</strong></p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Acesse o Radar Pastoral para mais detalhes sobre o histórico de participação
      e para registrar suas observações pastorais.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:6px;background-color:#1E40AF;">
          <a href="${safeUrl}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
            Ver no Radar Pastoral →
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderBaseLayout({ content, branding: opts.branding, subject });
  return { subject, html };
}
