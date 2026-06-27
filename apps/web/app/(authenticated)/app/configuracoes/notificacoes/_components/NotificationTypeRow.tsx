'use client';

/**
 * NotificationTypeRow — Story 16-1 (FR78)
 * Renders a single notification type row with two channel toggles (inApp + email).
 * Handles leader enforcement (pastoral_alert.inApp disabled for líder).
 */
import type { NotificationType } from '@metanoia/types';

interface ChannelToggleProps {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
  isMutating: boolean;
  tooltipText?: string;
}

function ChannelToggle({
  checked,
  disabled,
  label,
  onChange,
  isMutating,
  tooltipText,
}: ChannelToggleProps) {
  const isDisabled = disabled || isMutating;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="relative group">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-disabled={isDisabled || undefined}
          disabled={isDisabled}
          onClick={() => !isDisabled && onChange(!checked)}
          className={[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
            isDisabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer',
            checked && !isDisabled
              ? 'bg-blue-600'
              : checked && isDisabled
              ? 'bg-blue-400'
              : 'bg-gray-200',
          ].join(' ')}
          aria-label={label}
        >
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              'motion-safe:transition-transform',
              checked ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
        {tooltipText && disabled && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
            <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap max-w-48">
              {tooltipText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationTypeRowProps {
  type: NotificationType;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  isLeader: boolean;
  onToggle: (
    type: NotificationType,
    channel: 'inApp' | 'email',
    value: boolean,
  ) => void;
  isMutating: boolean;
  inAppChannelLabel: string;
  emailChannelLabel: string;
  leaderTooltip: string;
}

export function NotificationTypeRow({
  type,
  label,
  description,
  inApp,
  email,
  isLeader,
  onToggle,
  isMutating,
  inAppChannelLabel,
  emailChannelLabel,
  leaderTooltip,
}: NotificationTypeRowProps) {
  const leaderLocked = isLeader && type === 'pastoral_alert';

  return (
    <div
      data-testid={`notif-row-${type}`}
      className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
    >
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex gap-4 shrink-0">
        <ChannelToggle
          checked={inApp}
          disabled={leaderLocked}
          label={inAppChannelLabel}
          onChange={(v) => onToggle(type, 'inApp', v)}
          isMutating={isMutating}
          tooltipText={leaderLocked ? leaderTooltip : undefined}
        />
        <ChannelToggle
          checked={email}
          disabled={false}
          label={emailChannelLabel}
          onChange={(v) => onToggle(type, 'email', v)}
          isMutating={isMutating}
        />
      </div>
    </div>
  );
}
