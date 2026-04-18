'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button, Card, Input } from '@metanoia/ui';
import messages from '../../../../../messages/pt-BR.json';

type TokenState = 'loading' | 'valid' | 'expired' | 'used';

interface FieldErrors {
  newPassword?: string;
  confirmPassword?: string;
}

function resolveRedirect(role: string): string {
  switch (role) {
    case 'leader':
      return '/app/gestao/radar';
    case 'admin_tenant':
      return '/app/admin/boas-vindas';
    case 'participant':
      return '/app/consumo/grupos';
    default:
      return '/dashboard';
  }
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [tokenState, setTokenState] = useState<TokenState>('loading');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const t = messages.newPassword;

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(
          `/api/v1/auth/reset-password/${token}/validate`,
        );
        if (response.status === 404) {
          setTokenState('expired');
          return;
        }
        if (response.status === 409) {
          setTokenState('used');
          return;
        }
        if (!response.ok) {
          setTokenState('expired');
          return;
        }
        const { data } = await response.json();
        setMaskedEmail(data.email);
        setTokenState('valid');
      } catch {
        setTokenState('expired');
      }
    }
    void validateToken();
  }, [token]);

  function validate(): boolean {
    const fieldErrors: FieldErrors = {};

    if (newPassword.length < 8) {
      fieldErrors.newPassword = t.validation.tooShort;
    } else if (newPassword.length > 64) {
      fieldErrors.newPassword = t.validation.tooLong;
    }

    if (newPassword !== confirmPassword) {
      fieldErrors.confirmPassword = t.validation.mismatch;
    }

    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 404 || response.status === 410) {
          setTokenState('expired');
          return;
        }
        setServerError(body?.message ?? t.errors.generic);
        return;
      }

      const { data } = await response.json();

      sessionStorage.setItem('accessToken', data.accessToken);
      sessionStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.setItem('sessionId', data.sessionId);

      const primaryTenant = data.user.tenants[0];
      const role = primaryTenant?.role ?? 'leader';
      window.location.href = resolveRedirect(role);
    } catch {
      setServerError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  if (tokenState === 'loading') {
    return (
      <Card className="w-full max-w-md p-8" data-testid="reset-loading">
        <p className="text-body text-center text-text-secondary">...</p>
      </Card>
    );
  }

  if (tokenState === 'expired') {
    return (
      <Card className="w-full max-w-md p-8" data-testid="reset-expired">
        <h1 className="text-display mb-4 text-center">{t.tokenExpired.title}</h1>
        <p className="text-body mb-6 text-center text-text-secondary">
          {t.tokenExpired.message}
        </p>
        <Link
          href="/login"
          className="text-body-sm block text-center text-brand-primary hover:underline"
        >
          {t.tokenExpired.backToLogin}
        </Link>
      </Card>
    );
  }

  if (tokenState === 'used') {
    return (
      <Card className="w-full max-w-md p-8" data-testid="reset-used">
        <h1 className="text-display mb-4 text-center">{t.tokenUsed.title}</h1>
        <p className="text-body mb-6 text-center text-text-secondary">
          {t.tokenUsed.message}
        </p>
        <Link
          href="/login"
          className="text-body-sm block text-center text-brand-primary hover:underline"
        >
          {t.tokenUsed.backToLogin}
        </Link>
      </Card>
    );
  }

  const passwordValid = newPassword.length >= 8 && newPassword.length <= 64;
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-display mb-2 text-center">{t.title}</h1>
      {maskedEmail && (
        <p className="text-caption mb-6 text-center text-text-tertiary">
          {maskedEmail}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-4"
      >
        <div>
          <label
            htmlFor="new-password"
            className="text-body-sm mb-1 block text-text-secondary"
          >
            {t.password}
          </label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-invalid={!!errors.newPassword}
              aria-describedby={
                errors.newPassword ? 'new-password-error' : 'password-hint'
              }
              data-testid="new-password-input"
            />
            <button
              type="button"
              className="text-caption absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
              data-testid="toggle-password"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <p
            id="password-hint"
            className={`text-caption mt-1 ${passwordValid ? 'text-state-success' : 'text-text-tertiary'}`}
          >
            {passwordValid ? '✓ ' : ''}
            {t.passwordHint}
          </p>
          {errors.newPassword && (
            <p
              id="new-password-error"
              className="text-caption mt-1 text-state-danger"
              role="alert"
            >
              {errors.newPassword}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm-password"
            className="text-body-sm mb-1 block text-text-secondary"
          >
            {t.confirmPassword}
          </label>
          <Input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? 'confirm-password-error' : undefined
            }
            data-testid="confirm-password-input"
          />
          {passwordsMatch && (
            <p className="text-caption mt-1 text-state-success">✓</p>
          )}
          {errors.confirmPassword && (
            <p
              id="confirm-password-error"
              className="text-caption mt-1 text-state-danger"
              role="alert"
            >
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-caption text-state-danger" role="alert">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 w-full"
          data-testid="reset-submit"
        >
          {loading ? t.submitting : t.submit}
        </Button>
      </form>
    </Card>
  );
}
