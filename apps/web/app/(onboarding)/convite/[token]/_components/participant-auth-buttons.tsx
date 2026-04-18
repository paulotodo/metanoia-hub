"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@metanoia/ui";

interface ParticipantAuthButtonsProps {
  token: string;
}

/**
 * Spec 06.2 sections A1 + A2. Google is the canonical path (font-weight 600);
 * email/senha is the alternative (outlined, font-weight 400).
 *
 * Google triggers `/api/v1/auth/google?state=<base64>` — same backend endpoint
 * the login form uses (apps/web/app/(public)/login/_components/login-form.tsx),
 * but with a `state` payload so the OAuth callback can detect a participant
 * invite and accept it. Email path navigates to the existing create-account
 * sub-route, preserving the token.
 */
export function ParticipantAuthButtons({ token }: ParticipantAuthButtonsProps) {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleGoogleClick() {
    setGoogleLoading(true);
    const state = encodeOAuthState({ inviteToken: token, kind: "participant" });
    window.location.href = `/api/v1/auth/google?state=${state}`;
  }

  function handleEmailClick() {
    router.push(`/convite/${encodeURIComponent(token)}/criar-conta`);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        onClick={handleGoogleClick}
        disabled={googleLoading}
        className="h-12 w-full bg-white font-semibold text-[var(--color-text-primary)] hover:bg-white/90 border border-gray-300"
      >
        <GoogleMark />
        <span>{googleLoading ? "Abrindo Google..." : "Continuar com Google"}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleEmailClick}
        className="h-12 w-full font-normal"
      >
        Usar email e senha
      </Button>
    </div>
  );
}

function encodeOAuthState(payload: { inviteToken: string; kind: "participant" }): string {
  const json = JSON.stringify(payload);
  if (typeof window === "undefined") return "";
  return window.btoa(json);
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className="size-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.002-.001 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
