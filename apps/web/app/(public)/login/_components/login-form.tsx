'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LoginSchema } from '@metanoia/types';
import { Button, Card, Input } from '@metanoia/ui';
import { scrollToFirstError } from '@/lib/form-utils';
import messages from '../../../../messages/pt-BR.json';

// dec-029: FieldErrors gerenciado por useState (sem react-hook-form)
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
      // WCAG 1.3.1: mover foco para o primeiro campo inválido
      // scrollToFirstError usa requestAnimationFrame implícito via smooth scroll
      setTimeout(scrollToFirstError, 0);
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
            // dec-029: aria-invalid omitido (undefined) quando não há erro;
            // presente como "true" quando há. Evita aria-invalid="false" no DOM.
            aria-invalid={errors.email ? (true as unknown as boolean) : undefined}
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
              // dec-029: aria-invalid omitido quando válido
              aria-invalid={errors.password ? (true as unknown as boolean) : undefined}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            <button
              type="button"
              className="text-caption absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-text-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded-sm md:h-9 md:w-9 active:opacity-70"
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

        {/* dec-028: SubmitButton não usado aqui pois loading state usa mensagem inline;
            Button nativo mantido + aria-busy para consistência */}
        <Button
          type="submit"
          disabled={loading}
          aria-busy={loading || undefined}
          className="mt-2 w-full"
        >
          {loading ? (
            <>
              <span aria-hidden="true" className="mr-1.5 inline-block animate-spin">
                ⟳
              </span>
              {t.submit}
            </>
          ) : (
            t.submit
          )}
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
        <Link href="/register" className="text-brand-primary underline underline-offset-2">
          {t.createAccount}
        </Link>
      </p>
    </Card>
  );
}
