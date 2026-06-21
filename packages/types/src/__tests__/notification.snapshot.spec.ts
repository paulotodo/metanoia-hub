import { describe, it, expect } from 'vitest';
import {
  NotificationTypeSchema,
  NotificationChannelSchema,
  NotificationStatusSchema,
  NotificationDispatchSchema,
  NotificationPayloadSchema,
  NotificationResultSchema,
  NotificationJobPayloadSchema,
  NotificationRealtimeEventSchema,
  NOTIFICATIONS_QUEUE_NAME,
  NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS,
} from '../notification';

describe('NotificationTypeSchema', () => {
  it('accepts all valid types', () => {
    const types = ['pastoral_alert', 'group_message', 'content_update', 'meeting_reminder', 'system'];
    for (const t of types) {
      expect(NotificationTypeSchema.safeParse(t).success).toBe(true);
    }
  });
  it('rejects unknown type', () => {
    expect(NotificationTypeSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('NotificationChannelSchema', () => {
  it('accepts in_app and email', () => {
    expect(NotificationChannelSchema.safeParse('in_app').success).toBe(true);
    expect(NotificationChannelSchema.safeParse('email').success).toBe(true);
  });
  it('rejects unknown channel', () => {
    expect(NotificationChannelSchema.safeParse('sms').success).toBe(false);
  });
});

describe('NotificationStatusSchema', () => {
  it('accepts all valid statuses', () => {
    const statuses = ['pending', 'sent', 'failed', 'read'];
    for (const s of statuses) {
      expect(NotificationStatusSchema.safeParse(s).success).toBe(true);
    }
  });
  it('rejects unknown status', () => {
    expect(NotificationStatusSchema.safeParse('delivered').success).toBe(false);
  });
});

describe('NotificationDispatchSchema', () => {
  const valid = {
    userId: '019756c0-0002-7000-8000-000000000001',
    type: 'pastoral_alert',
    title: 'Alerta Pastoral',
    body: 'Membro em risco detectado',
    channels: ['in_app'],
    metadata: { groupId: 'abc' },
  };
  it('accepts valid dispatch', () => {
    const result = NotificationDispatchSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
  it('rejects empty channels', () => {
    const result = NotificationDispatchSchema.safeParse({ ...valid, channels: [] });
    expect(result.success).toBe(false);
  });
  it('rejects title over 200 chars', () => {
    const result = NotificationDispatchSchema.safeParse({ ...valid, title: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });
  it('rejects missing body', () => {
    const result = NotificationDispatchSchema.safeParse({ ...valid, body: '' });
    expect(result.success).toBe(false);
  });
  it('accepts multiple channels', () => {
    const result = NotificationDispatchSchema.safeParse({ ...valid, channels: ['in_app', 'email'] });
    expect(result.success).toBe(true);
  });
});

describe('NotificationJobPayloadSchema', () => {
  const valid = {
    notificationId: '019756c0-0002-7000-8000-000000000001',
    tenantId: '019756c0-0002-7000-8000-000000000002',
    userId: '019756c0-0002-7000-8000-000000000003',
    channel: 'in_app',
    correlationId: 'corr-abc-123',
  };
  it('accepts valid job payload', () => {
    const result = NotificationJobPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
  it('rejects invalid channel', () => {
    const result = NotificationJobPayloadSchema.safeParse({ ...valid, channel: 'sms' });
    expect(result.success).toBe(false);
  });
});

describe('NotificationRealtimeEventSchema', () => {
  const valid = {
    notificationId: '019756c0-0002-7000-8000-000000000001',
    type: 'group_message',
    title: 'Nova mensagem',
    body: 'Paulo enviou uma mensagem',
    createdAt: '2026-06-20T00:00:00.000Z',
  };
  it('accepts valid realtime event', () => {
    const result = NotificationRealtimeEventSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
  it('rejects invalid datetime', () => {
    const result = NotificationRealtimeEventSchema.safeParse({ ...valid, createdAt: 'not-a-date' });
    expect(result.success).toBe(false);
  });
});

describe('NotificationPayloadSchema', () => {
  const valid = {
    notificationId: '019756c0-0002-7000-8000-000000000001',
    tenantId: '019756c0-0002-7000-8000-000000000002',
    userId: '019756c0-0002-7000-8000-000000000003',
    channel: 'in_app',
    type: 'pastoral_alert',
    title: 'Alerta Pastoral',
    body: 'Membro em risco detectado',
    metadata: { actionUrl: '/app/radar' },
  };
  it('accepts valid payload', () => {
    expect(NotificationPayloadSchema.safeParse(valid).success).toBe(true);
  });
  it('accepts payload without optional metadata', () => {
    const result = NotificationPayloadSchema.safeParse({
      notificationId: valid.notificationId,
      tenantId: valid.tenantId,
      userId: valid.userId,
      channel: 'email',
      type: 'system',
      title: 'Resumo',
      body: 'Conteudo',
    });
    expect(result.success).toBe(true);
  });
  it('rejects non-uuid notificationId', () => {
    expect(NotificationPayloadSchema.safeParse({ ...valid, notificationId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('NotificationResultSchema', () => {
  it('accepts a success result', () => {
    expect(NotificationResultSchema.safeParse({ success: true }).success).toBe(true);
  });
  it('accepts a failure result with error message', () => {
    expect(NotificationResultSchema.safeParse({ success: false, error: 'channel timeout' }).success).toBe(true);
  });
  it('rejects missing success flag', () => {
    expect(NotificationResultSchema.safeParse({ error: 'x' }).success).toBe(false);
  });
});

describe('constants', () => {
  it('NOTIFICATIONS_QUEUE_NAME is correct', () => {
    expect(NOTIFICATIONS_QUEUE_NAME).toBe('notifications');
  });
  it('NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS is 5 minutes', () => {
    expect(NOTIFICATION_DIGEST_DEFAULT_WINDOW_MS).toBe(300000);
  });
});

// Story 14-2b: ReadAllResponseSchema + NotificationsListSchema snapshots
import {
  ReadAllResponseSchema,
  NotificationsListSchema,
  NotificationsQuerySchema,
} from '../notification';

describe('ReadAllResponseSchema', () => {
  it('matches snapshot', () => {
    expect(ReadAllResponseSchema.shape).toMatchSnapshot();
  });
  it('accepts valid read-all response', () => {
    expect(ReadAllResponseSchema.safeParse({ updatedCount: 5 }).success).toBe(true);
  });
  it('accepts zero count (idempotent call)', () => {
    expect(ReadAllResponseSchema.safeParse({ updatedCount: 0 }).success).toBe(true);
  });
  it('rejects negative count', () => {
    expect(ReadAllResponseSchema.safeParse({ updatedCount: -1 }).success).toBe(false);
  });
  it('rejects float count', () => {
    expect(ReadAllResponseSchema.safeParse({ updatedCount: 1.5 }).success).toBe(false);
  });
});

describe('NotificationsQuerySchema', () => {
  it('matches snapshot', () => {
    expect(NotificationsQuerySchema.shape).toMatchSnapshot();
  });
  it('accepts unread=true as string (coerce)', () => {
    const r = NotificationsQuerySchema.safeParse({ unread: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unread).toBe(true);
  });
  it('accepts without unread (optional)', () => {
    expect(NotificationsQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe('NotificationsListSchema', () => {
  it('matches snapshot', () => {
    expect(NotificationsListSchema.shape).toMatchSnapshot();
  });

  it('accepts a valid list response', () => {
    const valid = {
      data: [],
      meta: { page: 1, perPage: 20, total: 0 },
    };
    expect(NotificationsListSchema.safeParse(valid).success).toBe(true);
  });
});
