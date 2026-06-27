import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  NotificationPreferencesSchema,
  UpdateNotificationPreferencesSchema,
} from './preferences';

describe('NotificationPreferencesSchema snapshot', () => {
  it('matches snapshot', () => {
    expect(NotificationPreferencesSchema).toMatchSnapshot();
  });
});

describe('UpdateNotificationPreferencesSchema snapshot', () => {
  it('matches snapshot', () => {
    expect(UpdateNotificationPreferencesSchema).toMatchSnapshot();
  });
});

describe('UpdateNotificationPreferencesSchema strict validation', () => {
  it('rejects unknown top-level notification type', () => {
    const result = UpdateNotificationPreferencesSchema.safeParse({
      unknown_type: { inApp: true },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it('rejects unknown channel key inside a type', () => {
    const result = UpdateNotificationPreferencesSchema.safeParse({
      pastoral_alert: { inApp: true, push: true },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it('accepts partial updates with valid keys', () => {
    const result = UpdateNotificationPreferencesSchema.safeParse({
      pastoral_alert: { inApp: false },
      meeting_reminder: { email: false },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty patch object', () => {
    const result = UpdateNotificationPreferencesSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('NotificationPreferencesSchema validation', () => {
  it('validates a complete preferences object', () => {
    const full = {
      pastoral_alert: { inApp: true, email: true },
      group_message: { inApp: true, email: false },
      content_update: { inApp: true, email: true },
      meeting_reminder: { inApp: true, email: true },
      system: { inApp: true, email: true },
      export_ready: { inApp: true, email: true },
      content_new: { inApp: true, email: true },
    };
    const result = NotificationPreferencesSchema.safeParse(full);
    expect(result.success).toBe(true);
  });
});
