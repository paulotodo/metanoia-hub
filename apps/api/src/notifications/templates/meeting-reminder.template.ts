/**
 * meeting-reminder.template.ts — Email template for meeting reminders.
 *
 * 1.2.1 PT-BR vocabulary: "Encontro" for pastoral gatherings, "reunião" for admin.
 *        Since this is a group meeting, we use "Encontro de grupo" as default.
 * 1.2.6 Subject: [Metanoia] Lembrete: <date>
 * 1.2.5 Accessibility: semantic HTML, contrast >= 4.5:1.
 *
 * NOTE on deferral (spec.md §FR-11/P2): when rate limit is hit,
 * meeting_reminder immediately falls back to in-app notification.
 * Participant NEVER misses meeting time — no email deferral.
 */
import { renderBaseLayout, escapeHtml, validateUrl, type BrandingData } from './base.layout';
import type { EmailTemplateResult } from './pastoral-alert.template';

export interface MeetingReminderInput {
  /** Date in pt-BR format (e.g., "21 de junho de 2026") — escaped before rendering. */
  date: string;
  /** Time in pt-BR format (e.g., "19:00") — escaped. */
  time: string;
  /** Group/meeting name — escaped. */
  groupName: string;
  /** URL to join or view meeting details — validated. */
  meetingUrl: string;
  /** Tenant branding. */
  branding: BrandingData;
}

export function renderMeetingReminder(opts: MeetingReminderInput): EmailTemplateResult {
  const safeDate = escapeHtml(opts.date);
  const safeTime = escapeHtml(opts.time);
  const safeGroup = escapeHtml(opts.groupName);
  const safeUrl = validateUrl(opts.meetingUrl);

  // 1.2.6 subject convention
  const subject = `[Metanoia] Lembrete: ${opts.date}`;

  const content = `
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">
      Lembrete de encontro
    </h1>
    <p style="margin:0 0 20px;font-size:16px;color:#374151;line-height:1.6;">
      Você tem um encontro agendado. Não esqueça!
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background-color:#EFF6FF;border-left:4px solid #1E40AF;border-radius:4px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Grupo</p>
          <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">${safeGroup}</p>
          <p style="margin:0 0 4px;font-size:14px;color:#6B7280;">Data e hora</p>
          <p style="margin:0;font-size:16px;font-weight:600;color:#1E40AF;">${safeDate} às ${safeTime}</p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:6px;background-color:#1E40AF;">
          <a href="${safeUrl}" target="_blank"
             style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
            Ver detalhes do encontro →
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderBaseLayout({ content, branding: opts.branding, subject });
  return { subject, html };
}
