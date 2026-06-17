'use client';

import { useState } from 'react';
import { RegisterUserSchema } from '@metanoia/types';
import { Button, Card, Input } from '@metanoia/ui';
import { scrollToFirstError } from '@/lib/form-utils';
import messages from '../../../../messages/pt-BR.json';

interface FieldErrors {
  email?: string[];
  password?: string[];
  name?: string[];
}

export function RegisterForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const t = messages.register;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setServerError('');

    // Client-side: confirm password match
    if (password !== confirmPassword) {
      setErrors({ password: [t.errors.passwordMismatch] });
      setTimeout(scrollToFirstError, 0);
      return;
    }

    // Client-side: Zod validation
    const result = RegisterUserSchema.safeParse({ email, password, name });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      const mapped: FieldErrors = {};
      if (flat.email) mapped.email = flat.email;
      if (flat.password) {
        mapped.password = flat.password.map((msg) => {
          if (msg.includes('at least 12')) return t.errors.passwordTooShort;
          if (msg.includes('at most 64')) return t.errors.passwordTooLong;
          return msg;
        });
      }
      if (flat.name) mapped.name = flat.name;
      setErrors(mapped);
      setTimeout(scrollToFirstError, 0);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.message ?? t.errors.generic;

        if (body?.details) {
          setErrors(body.details as FieldErrors);
        } else {
          setServerError(message);
        }
        return;
      }

      setSuccess(true);
    } catch {
      setServerError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md p-8">
        <p className="text-body text-center text-state-success" role="status">
          {t.success}
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8">
      <h1 className="text-display mb-6 text-center">{t.title}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="register-name" className="text-body-sm mb-1 block text-text-secondary">
            {t.name}
          </label>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            // dec-029: aria-invalid omitido quando não há erro
            aria-invalid={errors.name ? (true as unknown as boolean) : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.name[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="register-email" className="text-body-sm mb-1 block text-text-secondary">
            {t.email}
          </label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            // dec-029: aria-invalid omitido quando não há erro
            aria-invalid={errors.email ? (true as unknown as boolean) : undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.email[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="register-password" className="text-body-sm mb-1 block text-text-secondary">
            {t.password}
          </label>
          {/* A11y: toggle button follows input in DOM order — Shift+Tab reversal natural.
              CHK005: no positive tabIndex used; reverse tab is guaranteed by DOM order. */}
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={64}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // dec-029: aria-invalid omitido quando não há erro
              aria-invalid={errors.password ? (true as unknown as boolean) : undefined}
              aria-describedby={
                errors.password ? 'password-hint password-error' : 'password-hint'
              }
            />
            <button
              type="button"
              className="text-caption absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 rounded-sm"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={
                showPassword ? messages.newPassword.hidePassword : messages.newPassword.showPassword
              }
              data-testid="register-toggle-password"
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <p id="password-hint" className="text-caption mt-1 text-text-tertiary">
            {t.passwordHint}
          </p>
          {errors.password && (
            <p id="password-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.password[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="register-confirm-password"
            className="text-body-sm mb-1 block text-text-secondary"
          >
            {t.confirmPassword}
          </label>
          {/* A11y: confirm password shares same showPassword toggle for consistency.
              aria-invalid tracks errors.password (passwordMismatch é sinalizado nele). */}
          <div className="relative">
            <Input
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={errors.password ? (true as unknown as boolean) : undefined}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
          </div>
        </div>

        {serverError && (
          <p className="text-caption text-state-danger" role="alert">
            {serverError}
          </p>
        )}

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
    </Card>
  );
}
