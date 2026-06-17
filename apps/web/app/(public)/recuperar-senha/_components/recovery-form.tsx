'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ForgotPasswordSchema } from '@metanoia/types';
import { Button, Card, Input } from '@metanoia/ui';
import { FormField } from '@/components/forms';
import { scrollToFirstError } from '@/lib/form-utils';
import { SubmitButton } from '@/lib/submit-button';
import messages from '../../../../messages/pt-BR.json';

type FormState = 'idle' | 'sending' | 'sent';

const RESEND_COOLDOWN = 60;

export function RecoveryForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [serverError, setServerError] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [countdown, setCountdown] = useState(0);

  const t = messages.recovery;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const submit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      setEmailError('');
      setServerError('');

      const result = ForgotPasswordSchema.safeParse({ email });
      if (!result.success) {
        setEmailError(t.errors.invalidEmail);
        scrollToFirstError();
        return;
      }

      setFormState('sending');
      try {
        const response = await fetch('/api/v1/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          setServerError(t.errors.generic);
          setFormState('idle');
          return;
        }

        setFormState('sent');
        setCountdown(RESEND_COOLDOWN);
      } catch {
        setServerError(t.errors.generic);
        setFormState('idle');
      }
    },
    [email, t],
  );

  function handleResend() {
    if (countdown > 0) return;
    setFormState('idle');
    void submit();
  }

  if (formState === 'sent') {
    return (
      <Card className="w-full max-w-md p-8" data-testid="recovery-sent">
        <h1 className="text-display mb-4 text-center">{t.sent.title}</h1>
        <p className="text-body mb-4 text-center text-text-secondary">
          {t.sent.message}
        </p>
        <p className="text-caption mb-6 text-center text-text-tertiary">
          {t.sent.spamHint}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full"
          disabled={countdown > 0}
          onClick={handleResend}
          data-testid="recovery-resend"
        >
          {countdown > 0
            ? t.sent.resendCountdown.replace('{seconds}', String(countdown))
            : t.sent.resend}
        </Button>

        <p className="text-body-sm text-center">
          <Link href="/login" className="text-brand-primary hover:underline">
            {t.backToLogin}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-display mb-2 text-center">{t.title}</h1>
      <p className="text-body mb-6 text-center text-text-secondary">
        {t.subtitle}
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormField label={t.email} error={emailError || undefined} required>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="recovery-email-input"
          />
        </FormField>

        {serverError && (
          <p className="text-caption text-state-danger" role="alert">
            {serverError}
          </p>
        )}

        <SubmitButton
          label={t.submit}
          pendingLabel={t.submitting}
          isPending={formState === 'sending'}
          className="mt-2 w-full"
          data-testid="recovery-submit"
        />
      </form>

      <p className="text-body-sm mt-6 text-center">
        <Link href="/login" className="text-brand-primary hover:underline">
          {t.backToLogin}
        </Link>
      </p>
    </Card>
  );
}
