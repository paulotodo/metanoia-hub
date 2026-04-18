'use client';

import { useEffect } from 'react';

interface OAuthState {
  inviteToken?: string;
  kind?: 'participant' | 'admin-tenant' | 'leader';
}

export default function AuthCallbackPage() {
  useEffect(() => {
    void handleCallback();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-text-secondary">Autenticando...</p>
    </div>
  );
}

async function handleCallback() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hash);

  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const sessionId = params.get('session_id');
  const hasConsent = params.get('has_consent') === 'true';
  const oauthState = decodeOAuthState(params.get('state'));

  if (!accessToken || !refreshToken || !sessionId) {
    window.location.href = '/login';
    return;
  }

  sessionStorage.setItem('accessToken', accessToken);
  sessionStorage.setItem('refreshToken', refreshToken);
  sessionStorage.setItem('sessionId', sessionId);

  // Clear hash from URL for security
  window.history.replaceState(null, '', '/auth/callback');

  // Cenário 06 — participant invite branch. Only fires when the OAuth flow
  // started from /convite/{token} (06.2). Default flows (admin-tenant /
  // standard leader login / Cenário 07 password recovery) leave `state`
  // unset and follow the unchanged redirect path below.
  if (oauthState?.inviteToken && oauthState.kind === 'participant') {
    const acceptResponse = await fetch(
      `/api/v1/invites/${encodeURIComponent(oauthState.inviteToken)}/accept`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    if (acceptResponse.ok) {
      window.location.href = '/app/consumo/grupos';
    } else {
      window.location.href = '/login?error=invite_unavailable';
    }
    return;
  }

  if (!hasConsent) {
    window.location.href = '/consent';
  } else {
    window.location.href = '/dashboard';
  }
}

function decodeOAuthState(raw: string | null): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(window.atob(raw)) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as OAuthState;
    }
    return null;
  } catch {
    return null;
  }
}
