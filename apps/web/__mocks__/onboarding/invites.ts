/**
 * Mock fixtures for invite validation (Session 0 of Cenário 05).
 * Shape derived from spec 05.1-aceite-convite.
 *
 * Covers the five states the page reacts to:
 *   valid | expired | used | invalid | network
 */

export type InviteStatus = "valid" | "expired" | "used" | "invalid";

/**
 * Response body of GET /api/v1/invites/{token}/validate.
 * On 200 (status: "valid") the body carries minimal, non-tenant-leaking hints.
 * On 404 / 409 the HTTP layer signals the state; a body is optional.
 */
export interface InviteValidateResponse {
  token: string;
  status: InviteStatus;
  /** ISO 8601 — when the token stops working. Only present for `valid`. */
  expiresAt: string | null;
}

/** Fixture token strings. Opaque on purpose — never derivable to tenant. */
export const mockInviteTokens = {
  valid: "inv_valid_019ABC000001",
  expired: "inv_expired_019ABC000002",
  used: "inv_used_019ABC000003",
  invalid: "inv_invalid_019ABC000004",
  network: "inv_network_019ABC000005",
} as const;

export type MockInviteTokenKey = keyof typeof mockInviteTokens;

/** A token still accepted by the backend — 6 days from now. */
export const mockInviteValid: InviteValidateResponse = {
  token: mockInviteTokens.valid,
  status: "valid",
  expiresAt: "2026-04-19T14:40:00Z",
};

/** Token older than 7 days. */
export const mockInviteExpired: InviteValidateResponse = {
  token: mockInviteTokens.expired,
  status: "expired",
  expiresAt: null,
};

/** Token whose `usedAt` is set. */
export const mockInviteUsed: InviteValidateResponse = {
  token: mockInviteTokens.used,
  status: "used",
  expiresAt: null,
};

/** Malformed token or not in database. */
export const mockInviteInvalid: InviteValidateResponse = {
  token: mockInviteTokens.invalid,
  status: "invalid",
  expiresAt: null,
};

/**
 * Lookup table used by MSW handlers and Storybook-style previews
 * to pick a fixture from the token path param.
 */
export const mockInvitesByToken: Record<string, InviteValidateResponse> = {
  [mockInviteTokens.valid]: mockInviteValid,
  [mockInviteTokens.expired]: mockInviteExpired,
  [mockInviteTokens.used]: mockInviteUsed,
  [mockInviteTokens.invalid]: mockInviteInvalid,
  // `network` deliberately absent — handler simulates fetch failure.
};

// --- POST /api/v1/invites/{token}/accept-terms ---

export interface AcceptTermsResponse {
  token: string;
  acceptedAt: string; // ISO 8601
  termsVersion: string;
}

export const mockAcceptTermsResponse: AcceptTermsResponse = {
  token: mockInviteTokens.valid,
  acceptedAt: "2026-04-13T14:42:00Z",
  termsVersion: "2026-04-01",
};

// --- POST /api/v1/invites/{token}/create-account ---

export interface CreateAccountRequest {
  name: string;
  email?: string;
  password?: string;
  oauthProvider?: "google";
  churchName: string;
}

export interface CreateAccountResponse {
  userId: string;
  tenantId: string;
  sessionToken: string;
}

export const mockCreateAccountResponse: CreateAccountResponse = {
  userId: "019756b0-0001-7000-8000-000000000001",
  tenantId: "019756b0-1000-7000-8000-000000000001",
  sessionToken: "sess_019756b0_demo_do_not_use_in_prod",
};
