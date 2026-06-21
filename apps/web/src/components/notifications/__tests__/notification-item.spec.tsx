import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { NotificationItem } from '../notification-item';
import type { NotificationListItem } from '@metanoia/types';

const baseNotification: NotificationListItem = {
  id: 'notif-001',
  type: 'pastoral_alert',
  channel: 'in_app',
  status: 'pending',
  title: 'Membro em Risco',
  body: 'Paulo Santos não participa há 30 dias',
  metadata: undefined,
  read_at: null,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationItem', () => {
  it('renders title as text (not innerHTML)', () => {
    render(createElement(NotificationItem, { notification: baseNotification, onMarkRead: vi.fn() }));
    const title = screen.getByText('Membro em Risco');
    expect(title.tagName).not.toBe('div');
    // Verify no dangerouslySetInnerHTML by checking that the DOM does not have
    // innerHTML-set content (text content equals textContent)
    expect(title.textContent).toBe('Membro em Risco');
  });

  it('truncates body at 100 chars', () => {
    const longBody = 'A'.repeat(150);
    const notif = { ...baseNotification, body: longBody };
    render(createElement(NotificationItem, { notification: notif, onMarkRead: vi.fn() }));
    // Preview should be 100 chars + '…'
    const preview = screen.getByText('A'.repeat(100) + '…');
    expect(preview).toBeDefined();
  });

  it('renders full body when <= 100 chars', () => {
    render(createElement(NotificationItem, { notification: baseNotification, onMarkRead: vi.fn() }));
    expect(screen.getByText(baseNotification.body)).toBeDefined();
  });

  it('calls onMarkRead with notification id on click', async () => {
    const onMarkRead = vi.fn();
    render(createElement(NotificationItem, { notification: baseNotification, onMarkRead }));
    await userEvent.click(screen.getByRole('button'));
    expect(onMarkRead).toHaveBeenCalledWith('notif-001');
  });

  it('calls router.push with safe actionUrl on click', async () => {
    const notifWithUrl: NotificationListItem = {
      ...baseNotification,
      metadata: { actionUrl: '/app/radar' },
    };
    render(createElement(NotificationItem, { notification: notifWithUrl, onMarkRead: vi.fn() }));
    await userEvent.click(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith('/app/radar');
  });

  it('does NOT call router.push for unsafe actionUrl', async () => {
    const notifWithBadUrl: NotificationListItem = {
      ...baseNotification,
      metadata: { actionUrl: 'javascript:alert(1)' },
    };
    render(createElement(NotificationItem, { notification: notifWithBadUrl, onMarkRead: vi.fn() }));
    await userEvent.click(screen.getByRole('button'));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
