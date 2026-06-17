'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginSchema } from '@metanoia/types';
import { Button, Card, Input } from '@metanoia/ui';
import messages from '../../../../messages/pt-BR.json';

interface FieldErrors {
  email?: string[];
  password?: string[];
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const t = messages.login;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setServerError('');

    // Client-side: Zod validation
    const result = LoginSchema.safeParse({ email, password });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      const mapped: FieldErrors = {};
      if (flat.email) mapped.email = flat.email;
      if (flat.password) mapped.password = flat.password;
      setErrors(mapped);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        if (response.status === 401) {
          setServerError(t.errors.invalidCredentials);
        } else {
          setServerError(body?.message ?? t.errors.generic);
        }
        return;
      }

      const { data } = await response.json();

      // Store tokens — will be consumed by useAuthStore when implemented
      sessionStorage.setItem('accessToken', data.accessToken);
      sessionStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.setItem('sessionId', data.sessionId);

      // Redirect based on consent and tenant state.
      // Consent route still pending; tracked as follow-up. Both tenant branches
      // converge to /selecionar-igreja, which renders an empty-state if the
      // user has no memberships.
      if (!data.user.hasConsent) {
        window.location.href = '/consent';
      } else {
        window.location.href = '/selecionar-igreja';
      }
    } catch {
      setServerError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-display mb-6 text-center">{t.title}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-email" className="text-body-sm mb-1 block text-text-secondary">
            {t.email}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
          />
          {errors.email && (
            <p id="login-email-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.email[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="login-password" className="text-body-sm mb-1 block text-text-secondary">
            {t.password}
          </label>
          {/* A11y: wrapper div with relative so toggle is positioned inside the input area.
              Tab order: input -> toggle button (natural DOM order, no tabIndex needed).
              Shift+Tab reversal is guaranteed by DOM order — no positive tabIndex used.
              CHK005 resolved: reverse tab order matches forward DOM order naturally. */}
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            <button
              type="button"
              className="text-caption absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded-sm"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? messages.newPassword.hidePassword : messages.newPassword.showPassword}
              data-testid="login-toggle-password"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          {errors.password && (
            <p id="login-password-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.password[0]}
            </p>
          )}
          <Link
            href="/recuperar-senha"
            className="text-caption mt-1 inline-block text-brand-primary underline underline-offset-2 hover:text-brand-primary/80"
          >
            {t.forgotPassword}
          </Link>
        </div>

        {serverError && (
          <p className="text-caption text-state-danger" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? '...' : t.submit}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <hr className="flex-1 border-border-default" />
        <span className="text-caption text-text-tertiary">{t.separator}</span>
        <hr className="flex-1 border-border-default" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          window.location.href = '/api/v1/auth/google';
        }}
      >
        {t.googleButton}
      </Button>

      <p className="text-body-sm mt-6 text-center text-text-secondary">
        {t.noAccount}{' '}
        <Link href="/register" className="text-brand-primary hover:underline">
          {t.createAccount}
        </Link>
      </p>
    </Card>
  );
}
