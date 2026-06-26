'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@metanoia/ui';
import messages from '../../../../../messages/pt-BR.json';

type ViewState = 'loading' | 'success' | 'error';

const t = messages.confirmEmail;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ConfirmEmailView({ token }: { token: string }) {
  const [state, setState] = useState<ViewState>('loading');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    let active = true;
    async function confirm() {
      try {
        const response = await fetch('/api/v1/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!active) return;
        setState(response.ok ? 'success' : 'error');
      } catch {
        if (active) setState('error');
      }
    }
    void confirm();
    return () => {
      active = false;
    };
  }, [token]);

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailError('');
    if (!isValidEmail(email)) {
      setEmailError(t.invalidEmail);
      return;
    }
    setResending(true);
    try {
      await fetch('/api/v1/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      setResent(true);
    } catch {
      // Generic UX: always show the same neutral confirmation.
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-6">
      <h1 className="mb-4 text-center text-lg font-semibold text-text-primary">
        {t.title}
      </h1>

      {state === 'loading' && (
        <p className="text-center text-body text-text-secondary" role="status">
          {t.loading}
        </p>
      )}

      {state === 'success' && (
        <div className="text-center">
          <p
            className="mb-2 text-body font-semibold text-state-success"
            role="status"
          >
            {t.successTitle}
          </p>
          <p className="mb-6 text-body text-text-secondary">{t.successBody}</p>
          <Link
            href="/login"
            className="text-body font-semibold text-brand-primary underline"
          >
            {t.goToLogin}
          </Link>
        </div>
      )}

      {state === 'error' && (
        <div>
          <p className="mb-2 text-body font-semibold text-state-danger" role="alert">
            {t.errorTitle}
          </p>
          <p className="mb-4 text-body text-text-secondary">{t.errorBody}</p>

          {resent ? (
            <p
              className="text-body text-text-secondary"
              role="status"
              data-testid="resend-confirmation"
            >
              {t.resendDone}
            </p>
          ) : (
            <form onSubmit={handleResend} noValidate>
              <label
                htmlFor="confirm-email-resend"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                {t.emailLabel}
              </label>
              <Input
                id="confirm-email-resend"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? 'confirm-email-error' : undefined}
              />
              {emailError && (
                <p
                  id="confirm-email-error"
                  role="alert"
                  className="mt-1 text-sm text-state-danger"
                >
                  {emailError}
                </p>
              )}
              <Button
                type="submit"
                disabled={resending || !email.trim()}
                className="mt-4 w-full"
              >
                {resending ? t.resending : t.resend}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
