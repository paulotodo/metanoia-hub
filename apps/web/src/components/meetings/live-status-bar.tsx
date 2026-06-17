"use client";

import { useEffect, useState } from "react";

interface LiveStatusBarProps {
  startedAt: string;
  label: string;
  detailsTemplate: string;
  connectingLabel?: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveStatusBar({
  startedAt,
  label,
  detailsTemplate,
  connectingLabel,
}: LiveStatusBarProps) {
  const startMs = new Date(startedAt).getTime();
  const isValid = !Number.isNaN(startMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!isValid) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3 text-sm text-text-secondary"
      >
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-text-muted" />
        <span>{connectingLabel ?? label}</span>
      </div>
    );
  }

  const elapsed = Math.max(0, Math.floor((now - startMs) / 1000));
  const duration = formatDuration(elapsed);
  const details = detailsTemplate.replace("{duration}", duration);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-3"
    >
      {/* motion-essential: dot de reunião ativa — isenção FR-3.4; safety net global cobre reduced-motion */}
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-care-alert"
      />
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <span className="text-xs text-text-secondary" data-testid="live-duration">
          {details}
        </span>
      </div>
    </div>
  );
}
