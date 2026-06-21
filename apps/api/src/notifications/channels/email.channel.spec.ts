import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailChannel } from './email.channel';
import type { EmailService } from './email.service';
import type { EmailRateLimiterService } from '../email-rate-limiter.service';
import type { EmailCircuitBreakerService } from '../email-circuit-breaker.service';
import type { BrandingService } from '../../tenants/branding.service';
import type { NotificationsService } from '../notifications.service';
import type { NotificationPayload } from '@metanoia/types';

/**
 * EmailChannel unit tests — verifies the delivery flow contract:
 * - send() NEVER throws (CHK001)
 * - circuit open → in-app fallback returned as success
 * - rate deferred (meeting_reminder) → in-app fallback returned as success
 * - successful send → updateStatus called with 'sent'
 * - retryable failure → {success: false} propagated for BullMQ retry
 */

const makePayload = (overrides: Partial<NotificationPayload> = {}): NotificationPayload => ({
  notificationId: '019756c0-0002-7000-8000-000000000001',
  tenantId: '019756c0-0002-7000-8000-000000000002',
  userId: '019756c0-0002-7000-8000-000000000003',
  channel: 'email',
  type: 'pastoral_alert',
  title: 'Alerta Pastoral',
  body: 'Membro em risco',
  metadata: {
    recipientEmail: 'leader@church.org',
    participantName: 'João',
    riskReason: 'Ausência',
    groupName: 'Grupo A',
    radarUrl: 'https://app.metanoia.app/radar/1',
  },
  ...overrides,
});

function makeChannel(overrides: {
  circuitOpen?: boolean;
  rateDecision?: string;
  sendSuccess?: boolean;
  sendRetryable?: boolean;
}) {
  const emailService = {
    send: vi.fn().mockResolvedValue(
      overrides.sendSuccess !== false
        ? { success: true, providerId: 'id-123' }
        : { success: false, error: 'Resend 503', retryable: overrides.sendRetryable ?? true },
    ),
  } as unknown as EmailService;

  const rateLimiter = {
    check: vi.fn().mockResolvedValue({
      decision: overrides.rateDecision ?? 'allow',
      count: 5,
      crossedThreshold: false,
      shouldFallbackInApp: overrides.rateDecision === 'defer',
    }),
  } as unknown as EmailRateLimiterService;

  const circuitBreaker = {
    isOpen: vi.fn().mockResolvedValue(overrides.circuitOpen ?? false),
    onSendSuccess: vi.fn().mockResolvedValue(undefined),
    onSendFailure: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailCircuitBreakerService;

  const brandingService = {
    getBranding: vi.fn().mockResolvedValue({
      primaryColor: null, secondaryColor: null, displayName: 'Test', logoUrl: null,
      plan: 'free', canCustomizeBranding: false,
    }),
  } as unknown as BrandingService;

  const notificationsService = {
    dispatch: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  } as unknown as NotificationsService;

  const channel = new EmailChannel(
    emailService,
    rateLimiter,
    circuitBreaker,
    brandingService,
    notificationsService,
  );

  return { channel, emailService, rateLimiter, circuitBreaker, brandingService, notificationsService };
}

describe('EmailChannel', () => {
  it('has channel property = email', () => {
    const { channel } = makeChannel({});
    expect(channel.channel).toBe('email');
  });

  it('send() never throws (CHK001)', async () => {
    // Even with all deps throwing, send() should resolve (not reject)
    const emailService = {
      send: vi.fn().mockRejectedValue(new Error('SDK crash')),
    } as unknown as EmailService;
    const rateLimiter = { check: vi.fn().mockResolvedValue({ decision: 'allow', count: 1, crossedThreshold: false, shouldFallbackInApp: false }) } as unknown as EmailRateLimiterService;
    const circuitBreaker = { isOpen: vi.fn().mockResolvedValue(false), onSendSuccess: vi.fn(), onSendFailure: vi.fn() } as unknown as EmailCircuitBreakerService;
    const brandingService = { getBranding: vi.fn().mockResolvedValue({ primaryColor: null, secondaryColor: null, displayName: null, logoUrl: null, plan: 'free', canCustomizeBranding: false }) } as unknown as BrandingService;
    const notificationsService = { dispatch: vi.fn(), updateStatus: vi.fn() } as unknown as NotificationsService;
    const channel = new EmailChannel(emailService, rateLimiter, circuitBreaker, brandingService, notificationsService);

    // Should NOT reject
    await expect(channel.send(makePayload())).resolves.toBeDefined();
  });

  it('circuit open → creates in-app fallback, returns success:true (FR-12)', async () => {
    const { channel, notificationsService } = makeChannel({ circuitOpen: true });
    const result = await channel.send(makePayload());
    expect(result.success).toBe(true);
    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ['in_app'], metadata: expect.objectContaining({ fallbackOf: makePayload().notificationId }) }),
    );
  });

  it('rate deferred (meeting_reminder) → in-app fallback, returns success:true (FR-11/P2)', async () => {
    const { channel, notificationsService } = makeChannel({ rateDecision: 'defer' });
    const payload = makePayload({ type: 'meeting_reminder', metadata: { recipientEmail: 'user@example.com', meetingDate: '21 de junho', meetingTime: '19:00', groupName: 'G', meetingUrl: 'https://app.metanoia.app' } });
    const result = await channel.send(payload);
    expect(result.success).toBe(true);
    expect(notificationsService.dispatch).toHaveBeenCalled();
  });

  it('successful send → updateStatus(sent) called + success:true (FR-01)', async () => {
    const { channel, notificationsService, circuitBreaker } = makeChannel({ sendSuccess: true });
    const result = await channel.send(makePayload());
    expect(result.success).toBe(true);
    expect(notificationsService.updateStatus).toHaveBeenCalledWith(
      makePayload().notificationId,
      'sent',
    );
    expect(circuitBreaker.onSendSuccess).toHaveBeenCalled();
  });

  it('retryable failure → success:false propagated for BullMQ retry (NFR-I2)', async () => {
    const { channel, circuitBreaker } = makeChannel({ sendSuccess: false, sendRetryable: true });
    const result = await channel.send(makePayload());
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(circuitBreaker.onSendFailure).toHaveBeenCalled();
  });

  it('permanent failure (retryable:false) → success:false, no circuit increment', async () => {
    const { channel, circuitBreaker } = makeChannel({ sendSuccess: false, sendRetryable: false });
    const circuitBreakerSpy = circuitBreaker.onSendFailure as ReturnType<typeof vi.fn>;
    const result = await channel.send(makePayload());
    expect(result.success).toBe(false);
    // Permanent errors do NOT open the circuit breaker
    expect(circuitBreakerSpy).not.toHaveBeenCalled();
  });

  it('unknown notification type → success:false (no template)', async () => {
    const { channel } = makeChannel({});
    const result = await channel.send(makePayload({ type: 'group_message' }));
    // group_message has no email template → returns false
    expect(result.success).toBe(false);
    expect(result.error).toContain('No email template');
  });
});
