/**
 * Google OAuth mock profile (spec 05.3).
 *
 * Session 3 simulates a successful OAuth round-trip entirely on the client
 * so the form can demonstrate the "post-OAuth" state without a real Google
 * dependency. Session 5 will replace this with a popup-based flow against
 * the backend (`/api/v1/auth/google`).
 */
export interface MockGoogleOAuthProfile {
  name: string;
  email: string;
}

export const mockGoogleOAuthProfile: MockGoogleOAuthProfile = {
  name: "Pastor Carlos Silva",
  email: "carlos.silva@gmail.com",
};
