import { radarHandlers } from './radar';
import { invitesHandlers } from './invites';
import { onboardingHandlers } from './onboarding';
import { groupsHandlers } from './groups';
import { tenantsHandlers } from './tenants';
import { meetingsHandlers } from './meetings';
import { pastoralAdminHandlers } from './pastoral-admin';
import { authTenantSelectionHandlers } from './auth-tenant-selection';
import { authRecoveryHandlers } from './auth-recovery';
import { participantGroupsHandlers } from './participant-groups';
import { superAdminTenantsHandlers } from './super-admin-tenants';
import { usersHandlers } from './users';
import { trailStructureHandlers } from './trail-structure';
import { myTrailsHandlers } from './my-trails';
import { auditEventsHandlers } from './audit-events';
import { consentPrivacyHandlers } from './consent-privacy';
import { privacyHandlers } from './privacy';

export const handlers = [
  ...radarHandlers,
  ...invitesHandlers,
  ...onboardingHandlers,
  ...groupsHandlers,
  ...tenantsHandlers,
  ...meetingsHandlers,
  ...pastoralAdminHandlers,
  ...authTenantSelectionHandlers,
  ...authRecoveryHandlers,
  ...participantGroupsHandlers,
  ...superAdminTenantsHandlers,
  ...usersHandlers,
  ...trailStructureHandlers,
  ...myTrailsHandlers,
  ...auditEventsHandlers,
  ...consentPrivacyHandlers,
  ...privacyHandlers,
];
