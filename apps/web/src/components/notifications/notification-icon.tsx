import * as React from 'react';
import type { NotificationType } from '@metanoia/types';

const ICON_MAP: Record<NotificationType, string> = {
  pastoral_alert: '⚠️',
  group_message: '💬',
  content_update: '📚',
  meeting_reminder: '📅',
  system: '🔔',
  export_ready: '📥',
  content_new: '✨',
};

interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

export function NotificationIcon({ type, className }: NotificationIconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      role="img"
    >
      {ICON_MAP[type] ?? '🔔'}
    </span>
  );
}
