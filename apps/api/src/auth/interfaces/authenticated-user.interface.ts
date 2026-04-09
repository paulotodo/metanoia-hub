export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  roles: string[];
  email: string;
}
