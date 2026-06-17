'use client';

import { useState } from 'react';
import { Button, Input } from '@metanoia/ui';
import { WIZARD_SKIP_LATER_LABEL } from '@metanoia/types';
import messages from '../../../../../messages/pt-BR.json';

const t = messages.onboardingWizard;

interface Step4InviteProps {
  /** If mode is 'demo', this step is auto-skipped by OnboardingWizard. */
  onComplete: (skipped: boolean) => void;
  readOnly?: boolean;
}

export function Step4Invite({ onComplete, readOnly = false }: Step4InviteProps) {
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);

    if (!isValidEmail(leaderEmail)) {
      setError(t.errors.inviteInvalidEmail);
      return;
    }

    setIsPending(true);
    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
      const token = sessionStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE_URL}/admin/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          inviteeEmail: leaderEmail.trim(),
          inviteeName: leaderName.trim(),
          kind: 'tenant_leader',
          expiresInDays: 7,
        }),
      });

      if (res.status === 409) {
        setError(t.errors.inviteAlreadyMember);
        return;
      }
      if (!res.ok) {
        setError(t.errors.inviteFailed);
        return;
      }

      onComplete(false);
    } catch {
      setError(t.errors.inviteFailed);
    } finally {
      setIsPending(false);
    }
  }

  function handleSkip() {
    onComplete(true);
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
      <p className="text-sm text-text-secondary">{t.step4.description}</p>

      <div className="space-y-2">
        <label htmlFor="wizard-leader-name" className="block text-sm font-medium text-text-primary">
          {t.step4.leaderNameLabel}
        </label>
        <Input
          id="wizard-leader-name"
          type="text"
          value={leaderName}
          onChange={(e) => setLeaderName(e.target.value)}
          placeholder={t.step4.leaderNamePlaceholder}
          disabled={readOnly || isPending}
          aria-required="false"
          data-testid="step4-leader-name"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="wizard-leader-email" className="block text-sm font-medium text-text-primary">
          {t.step4.leaderEmailLabel}
        </label>
        <Input
          id="wizard-leader-email"
          type="email"
          value={leaderEmail}
          onChange={(e) => setLeaderEmail(e.target.value)}
          placeholder={t.step4.leaderEmailPlaceholder}
          disabled={readOnly || isPending}
          aria-required="false"
          data-testid="step4-leader-email"
        />
      </div>

      {error && (
        <p id="step4-invite-error" role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      {!readOnly && (
        <div className="space-y-3">
          <Button
            type="submit"
            className="w-full"
            disabled={!leaderName.trim() || !leaderEmail.trim() || isPending}
            aria-busy={isPending || undefined}
            data-testid="step4-invite-submit"
          >
            {isPending ? (
              <>
                <span aria-hidden="true" className="mr-1.5 inline-block animate-spin">⟳</span>
                {t.step4.inviteButton}
              </>
            ) : t.step4.inviteButton}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleSkip}
            disabled={isPending}
            data-testid="step4-skip"
          >
            {WIZARD_SKIP_LATER_LABEL}
          </Button>
        </div>
      )}
    </form>
  );
}
