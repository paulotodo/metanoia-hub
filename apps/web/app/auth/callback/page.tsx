'use client';

import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(hash);

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const sessionId = params.get('session_id');
    const hasConsent = params.get('has_consent') === 'true';

    if (accessToken && refreshToken && sessionId) {
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('sessionId', sessionId);

      // Clear hash from URL for security
      window.history.replaceState(null, '', '/auth/callback');

      if (!hasConsent) {
        window.location.href = '/consent';
      } else {
        window.location.href = '/dashboard';
      }
    } else {
      // Missing tokens — redirect to login
      window.location.href = '/login';
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-text-secondary">Autenticando...</p>
    </div>
  );
}
