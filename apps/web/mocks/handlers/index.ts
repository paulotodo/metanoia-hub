import { radarHandlers } from './radar';
import { invitesHandlers } from './invites';
import { onboardingHandlers } from './onboarding';
import { groupsHandlers } from './groups';
import { tenantsHandlers } from './tenants';
import { meetingsHandlers } from './meetings';

export const handlers = [
  ...radarHandlers,
  ...invitesHandlers,
  ...onboardingHandlers,
  ...groupsHandlers,
  ...tenantsHandlers,
  ...meetingsHandlers,
];
