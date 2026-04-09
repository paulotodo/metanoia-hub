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

      // Redirect based on consent and tenant state
      if (!data.user.hasConsent) {
        window.location.href = '/consent';
      } else if (data.user.tenants.length === 0) {
        window.location.href = '/tenant/select';
      } else {
        window.location.href = '/dashboard';
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
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
          />
          {errors.password && (
            <p id="login-password-error" className="text-caption mt-1 text-state-danger" role="alert">
              {errors.password[0]}
            </p>
          )}
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
