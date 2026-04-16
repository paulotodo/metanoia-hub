'use client';

import { useState } from 'react';
import { Button } from '@metanoia/ui';

export function CopyLinkButton({
  label,
  copiedLabel,
}: {
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={handleClick}
      data-testid="deck-copy-link"
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}
