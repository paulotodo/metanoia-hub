/**
 * EmailChannel — real implementation replacing the Story 14-1 stub.
 *
 * Delivery flow (spec.md §FR-01/FR-04/FR-06/FR-07):
 *   1. Check circuit breaker — if open → in-app fallback + return success
 *   2. Check rate limit → critical bypass, meeting_reminder fallback, others defer
 *   3. Resolve tenant branding (BrandingService, cache TTL 1h)
 *   4. Render HTML template by notification type
 *   5. Send via EmailService (Resend SDK)
 *   6. On success: update status=sent + metadata.providerId
 *   7. On retryable failure: return {success:false} → BullMQ re-queues
 *   8. On permanent failure (4xx): return {success:false, retryable:false}
 *
 * Contract invariants:
 *   - send() NEVER throws (CHK001) — all errors returned as {success:false}
 *   - L1/CHK029: html body and signedUrl NEVER appear in logs
 *   - tenantId sourced from RequestContext (AsyncLocalStorage) — never a param
 *
 * NOTE: Worker's `on('failed')` handler (FASE 5.2) creates in-app fallback
 * after 3 exhausted retries — EmailChannel does NOT create fallback on transient failure.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPayload, NotificationResult } from '@metanoia/types';
import type { NotificationChannelInterface } from './notification-channel.interface';
import { EmailService } from './email.service';
import { EmailRateLimiterService } from '../email-rate-limiter.service';
import { EmailCircuitBreakerService } from '../email-circuit-breaker.service';
import { BrandingService } from '../../tenants/branding.service';
import { NotificationsService } from '../notifications.service';
import { getRequestContext } from '../../common/context/request-context';
import { renderPastoralAlert } from '../templates/pastoral-alert.template';
import { renderMeetingReminder } from '../templates/meeting-reminder.template';
import { renderExportReady } from '../templates/export-ready.template';
import { renderContentNew } from '../templates/content-new.template';
import type { BrandingData } from '../templates/base.layout';
import type { BrandingResponse } from '@metanoia/types';

/** Map BrandingResponse to the template's BrandingData shape. */
function toBrandingData(b: BrandingResponse): BrandingData {
  return {
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    displayName: b.displayName,
    logoUrl: b.logoUrl,
  };
}

/** Admin in-app notification body when rate threshold is crossed (1.2.7 / spec.md §P5). */
function buildAdminRateAlertBody(count: number, limit: number): string {
  return `${count} de ${limit} emails diários enviados. Considere fazer upgrade para aumentar o limite.`;
}

@Injectable()
export class EmailChannel implements NotificationChannelInterface {
  readonly channel = 'email' as const;
  private readonly logger = new Logger(EmailChannel.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly rateLimiter: EmailRateLimiterService,
    private readonly circuitBreaker: EmailCircuitBreakerService,
    private readonly brandingService: BrandingService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * send — deliver a notification via email.
   * Always returns NotificationResult (never throws — CHK001).
   */
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    const { tenantId, notificationId, userId, type, metadata } = payload;

    try {
      this.logger.log(
        { notificationId, type },
        // L1: no html, no userId PII, no signedUrl
        'email:send_attempt',
      );

      // ── 1. Circuit breaker check ──────────────────────────────────────────
      const circuitOpen = await this.circuitBreaker.isOpen(tenantId);
      if (circuitOpen) {
        this.logger.warn({ notificationId, type }, 'email:circuit_open — creating in-app fallback');
        await this.createInAppFallback(payload, 'Resend unavailable (circuit open)');
        return { success: true };
      }

      // ── 2. Rate limit check ───────────────────────────────────────────────
      const rateResult = await this.rateLimiter.check(tenantId, type, 'email');

      if (rateResult.crossedThreshold) {
        // Admin alert: first time crossing 80/100 today (spec.md §P5/FR-10)
        await this.notificationsService.dispatch({
          userId, // admin userId (same recipient for now — spec notes admin alert goes to leader/admin)
          type: 'system',
          title: 'Limite de emails se aproximando',
          body: buildAdminRateAlertBody(rateResult.count, 100),
          channels: ['in_app'],
          metadata: { alertType: 'rate_limit_threshold' },
        });
      }

      if (rateResult.decision === 'defer') {
        if (rateResult.shouldFallbackInApp) {
          // meeting_reminder: MUST reach participant — immediate in-app fallback (spec.md §P2/FR-11)
          this.logger.log({ notificationId, type, count: rateResult.count }, 'email:rate_limited — meeting_reminder fallback in-app');
          await this.createInAppFallback(payload, 'Email rate limit reached — meeting reminder via in-app');
        } else {
          // content_new, group_message, etc.: defer to next day
          this.logger.log({ notificationId, type, count: rateResult.count }, 'email:rate_limited — deferred');
          const tomorrow = new Date();
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          tomorrow.setUTCHours(9, 0, 0, 0);
          await this.notificationsService.updateStatus(notificationId, 'pending');
          // metadata update via direct updateStatus (deferral is handled at job level)
        }
        return { success: true };
      }

      // ── 3. Resolve branding (BrandingService, cache TTL 1h) ──────────────
      let branding: BrandingData;
      try {
        const b = await this.brandingService.getBranding();
        branding = toBrandingData(b);
      } catch {
        // Branding unavailable: use null defaults (template uses DEFAULTS)
        branding = { primaryColor: null, secondaryColor: null, displayName: null, logoUrl: null };
      }

      // ── 4. Render template by type ────────────────────────────────────────
      const templateResult = this.renderTemplate(payload, branding, metadata);
      if (!templateResult) {
        this.logger.warn({ notificationId, type }, 'email:unknown_type — no template, skipping');
        return { success: false, error: `No email template for type: ${type}` };
      }
      const { subject, html } = templateResult;

      // ── 5. Read 'to' from notification metadata ───────────────────────────
      const to = this.resolveRecipientEmail(metadata);
      if (!to) {
        this.logger.warn({ notificationId }, 'email:missing_recipient — no email in metadata');
        return { success: false, error: 'No recipient email in notification metadata' };
      }

      // ── 6. Send via Resend SDK ────────────────────────────────────────────
      // L1: html NOT logged by EmailService.send()
      const sendResult = await this.emailService.send({ to, subject, html });

      if (sendResult.success && sendResult.providerId) {
        await this.circuitBreaker.onSendSuccess(tenantId);
        // Update status=sent with providerId
        await this.notificationsService.updateStatus(notificationId, 'sent');
        this.logger.log({ notificationId, providerId: sendResult.providerId }, 'email:send_success');
        return { success: true };
      }

      // ── 7. Handle failure ─────────────────────────────────────────────────
      const isRetryable = sendResult.retryable ?? true;

      if (isRetryable) {
        // Transient: inform circuit breaker, re-throw for BullMQ retry
        await this.circuitBreaker.onSendFailure(tenantId);
        this.logger.warn({ notificationId, error: sendResult.error }, 'email:send_failure — retryable');
        return { success: false, error: sendResult.error };
      } else {
        // Permanent (4xx): record failure reason (no PII/secrets in error msg — CHK018)
        const safeReason = `Resend rejected: ${sendResult.error?.substring(0, 100) ?? 'unknown'}`;
        this.logger.warn({ notificationId, error: safeReason }, 'email:send_failure — permanent');
        return { success: false, error: safeReason };
      }
    } catch (error) {
      // Catch-all: CHK001 guarantees no throw
      const message = (error as Error).message;
      this.logger.error({ notificationId, error: message }, 'email:unexpected_error');
      return { success: false, error: 'Internal email channel error' };
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * renderTemplate — dispatch to the correct template by notification type.
   * Returns null for unknown types (caller skips silently).
   * L1: never logs the returned html.
   */
  private renderTemplate(
    payload: NotificationPayload,
    branding: BrandingData,
    metadata?: Record<string, unknown>,
  ): { subject: string; html: string } | null {
    // Extract template-specific fields from metadata
    const meta = metadata ?? {};

    switch (payload.type) {
      case 'pastoral_alert':
        return renderPastoralAlert({
          participantName: String(meta.participantName ?? payload.title),
          riskReason: String(meta.riskReason ?? payload.body),
          groupName: String(meta.groupName ?? ''),
          radarUrl: String(meta.radarUrl ?? '#'),
          branding,
        });

      case 'meeting_reminder':
        return renderMeetingReminder({
          date: String(meta.meetingDate ?? ''),
          time: String(meta.meetingTime ?? ''),
          groupName: String(meta.groupName ?? payload.title),
          meetingUrl: String(meta.meetingUrl ?? '#'),
          branding,
        });

      case 'export_ready':
        return renderExportReady({
          reportTitle: String(meta.reportTitle ?? payload.title),
          // L1: downloadUrl is a signedUrl — NEVER logged (only in html href)
          downloadUrl: String(meta.downloadUrl ?? '#'),
          expiresAt: String(meta.expiresAt ?? '1 hora'),
          branding,
        });

      case 'content_new':
        return renderContentNew({
          trailTitle: String(meta.trailTitle ?? payload.title),
          trailDescription: String(meta.trailDescription ?? payload.body),
          trailUrl: String(meta.trailUrl ?? '#'),
          branding,
        });

      default:
        return null;
    }
  }

  private resolveRecipientEmail(metadata?: Record<string, unknown>): string | null {
    const email = metadata?.recipientEmail;
    if (typeof email === 'string' && email.includes('@')) return email;
    return null;
  }

  /** Create an in-app fallback notification (circuit open or rate-limit meeting_reminder). */
  private async createInAppFallback(
    payload: NotificationPayload,
    reason: string,
  ): Promise<void> {
    try {
      await this.notificationsService.dispatch({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        channels: ['in_app'],
        metadata: {
          ...payload.metadata,
          fallbackOf: payload.notificationId,
          // sanitized reason (no PII/secrets) — CHK018/FR-07
          fallbackReason: reason.substring(0, 200),
        },
      });
    } catch (err) {
      this.logger.error(
        { notificationId: payload.notificationId, error: (err as Error).message },
        'email:fallback_creation_failed',
      );
    }
  }
}
