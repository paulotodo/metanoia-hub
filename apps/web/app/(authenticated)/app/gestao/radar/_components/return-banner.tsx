"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ReturnBannerProps {
  lastSeenAt: string;
}

function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function ReturnBanner({ lastSeenAt }: ReturnBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const days = daysSince(lastSeenAt);

  if (days <= 5 || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between rounded-lg border border-care-attention/30 bg-care-attention/5 px-4 py-3"
    >
      <div>
        <p className="text-sm font-medium text-text-primary">
          Muita coisa mudou desde sua última visita
        </p>
        <p className="text-xs text-text-secondary">
          Faz {days} dias que você não entrava
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dispensar aviso de retorno"
        className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-focus"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
