import { radarHandlers } from './radar';
import { invitesHandlers } from './invites';
import { onboardingHandlers } from './onboarding';
import { groupsHandlers } from './groups';
import { tenantsHandlers } from './tenants';
import { meetingsHandlers } from './meetings';
import { pastoralAdminHandlers } from './pastoral-admin';

export const handlers = [
  ...radarHandlers,
  ...invitesHandlers,
  ...onboardingHandlers,
  ...groupsHandlers,
  ...tenantsHandlers,
  ...meetingsHandlers,
  ...pastoralAdminHandlers,
];
