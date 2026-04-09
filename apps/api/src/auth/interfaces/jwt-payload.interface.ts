export interface KeycloakJwtPayload {
  /** Keycloak user ID */
  sub: string;
  /** Mapped via protocol mapper */
  user_id: string;
  /** Custom user attribute — tenant isolation */
  tenant_id: string;
  /** Realm roles mapped via protocol mapper */
  realm_roles: string[];
  email: string;
  email_verified: boolean;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  /** Keycloak issuer URL */
  iss: string;
  /** Audience */
  aud: string | string[];
  /** Expiration (unix timestamp) */
  exp: number;
  /** Issued at (unix timestamp) */
  iat: number;
}
