import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import AuthCallbackPage from "../page";

/**
 * Non-regression suite for /auth/callback. Until Cenário 06 Session 1 the
 * callback was a single-purpose handler for the standard OAuth flow (admin
 * tenant + leader login). This Session adds an opt-in branch that reads
 * `state.inviteToken` and accepts a participant invite. Every test that
 * omits `state` MUST behave exactly as the pre-Session 1 baseline.
 */

interface LocationStub {
  href: string;
  hash: string;
  search: string;
}

let location: LocationStub;
let originalLocation: Location;

function stubLocation(hash: string, search: string) {
  location = { href: "", hash, search };
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: location,
  });
}

beforeEach(() => {
  originalLocation = window.location;
  sessionStorage.clear();
  window.history.replaceState = vi.fn();
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
});

describe("/auth/callback — non-regression (no state.inviteToken)", () => {
  it("redirects to /dashboard when tokens present and consent granted", async () => {
    stubLocation(
      "#access_token=a&refresh_token=r",
      "?session_id=s&has_consent=true",
    );
    render(<AuthCallbackPage />);
    await waitFor(() => expect(location.href).toBe("/dashboard"));
    expect(sessionStorage.getItem("accessToken")).toBe("a");
    expect(sessionStorage.getItem("refreshToken")).toBe("r");
    expect(sessionStorage.getItem("sessionId")).toBe("s");
  });

  it("redirects to /consent when has_consent is false", async () => {
    stubLocation(
      "#access_token=a&refresh_token=r",
      "?session_id=s&has_consent=false",
    );
    render(<AuthCallbackPage />);
    await waitFor(() => expect(location.href).toBe("/consent"));
  });

  it("redirects to /login when tokens are missing", async () => {
    stubLocation("", "?session_id=s&has_consent=true");
    render(<AuthCallbackPage />);
    await waitFor(() => expect(location.href).toBe("/login"));
  });
});

describe("/auth/callback — participant invite branch (state.inviteToken)", () => {
  it("calls /accept and redirects to /app/consumo/grupos on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const state = window.btoa(
      JSON.stringify({ inviteToken: "participant-valid", kind: "participant" }),
    );
    stubLocation(
      "#access_token=a&refresh_token=r",
      `?session_id=s&has_consent=true&state=${state}`,
    );

    render(<AuthCallbackPage />);

    await waitFor(() =>
      expect(location.href).toBe("/app/consumo/grupos"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/invites/participant-valid/accept",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer a" },
      }),
    );
  });

  it("redirects to /login?error=invite_unavailable on 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409 });
    vi.stubGlobal("fetch", fetchMock);
    const state = window.btoa(
      JSON.stringify({ inviteToken: "participant-used", kind: "participant" }),
    );
    stubLocation(
      "#access_token=a&refresh_token=r",
      `?session_id=s&has_consent=true&state=${state}`,
    );

    render(<AuthCallbackPage />);

    await waitFor(() =>
      expect(location.href).toBe("/login?error=invite_unavailable"),
    );
  });

  it("ignores malformed state (falls through to default redirect)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    stubLocation(
      "#access_token=a&refresh_token=r",
      "?session_id=s&has_consent=true&state=not-base64-json",
    );

    render(<AuthCallbackPage />);

    await waitFor(() => expect(location.href).toBe("/dashboard"));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
