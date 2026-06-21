import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

// Mock all hooks used by NotificationBell
vi.mock('@/lib/api/hooks/use-notifications', () => ({
  notificationKeys: {
    all: ['notifications'],
    unread: () => ['notifications', 'unread'],
  },
  useUnreadNotifications: vi.fn(),
}));

vi.mock('@/hooks/use-notification-silence', () => ({
  useNotificationSilence: vi.fn(() => ({ silenced: false, setSilenced: vi.fn() })),
}));

vi.mock('@/hooks/use-notification-stream', () => ({
  useNotificationStream: vi.fn().mockReturnValue({ connectionState: 'connected', retryNow: vi.fn() }),
}));

vi.mock('@/components/a11y/async-announcer', () => ({
  useAsyncAnnouncer: vi.fn(() => ({ announce: vi.fn() })),
}));

import { NotificationBell } from '../notification-bell';
import { useUnreadNotifications } from '@/lib/api/hooks/use-notifications';

const mockUseUnread = vi.mocked(useUnreadNotifications);

describe('NotificationBell', () => {
  it('shows no badge when unreadCount is 0', () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 0, isLoading: false, isError: false });
    render(createElement(NotificationBell));
    expect(screen.queryByText(/\d/)).toBeNull();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('Sem notificações');
  });

  it('shows badge with count when 3 unread', () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 3, isLoading: false, isError: false });
    render(createElement(NotificationBell));
    expect(screen.getByText('3')).toBeDefined();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('3 notificações não lidas');
  });

  it('shows 99+ when unread count > 99', () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 100, isLoading: false, isError: false });
    render(createElement(NotificationBell));
    expect(screen.getByText('99+')).toBeDefined();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('99+ notificações não lidas');
  });

  it('shows singular label for 1 unread', () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 1, isLoading: false, isError: false });
    render(createElement(NotificationBell));
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('1 notificação não lida');
  });

  it('badge at exactly 99 shows 99 not 99+', () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 99, isLoading: false, isError: false });
    render(createElement(NotificationBell));
    expect(screen.getByText('99')).toBeDefined();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toBe('99 notificações não lidas');
  });

  it('calls onClick when button is clicked', async () => {
    mockUseUnread.mockReturnValue({ notifications: [], unreadCount: 0, isLoading: false, isError: false });
    const onClick = vi.fn();
    render(createElement(NotificationBell, { onClick }));
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
