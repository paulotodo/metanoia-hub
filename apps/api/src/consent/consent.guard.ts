import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConsentService } from './consent.service';
import { getRequestContext } from '../common/context/request-context';

export const SKIP_CONSENT_META = 'consent:skip';

import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as not requiring up-to-date consent. Apply to the consent
 * endpoints themselves and to public-ish routes that authenticated users
 * should still hit (e.g., logout, password change).
 */
export const SkipConsent = () => SetMetadata(SKIP_CONSENT_META, true);

/**
 * Story 2-8 — gate that rejects requests when the authenticated user hasn't
 * accepted the current version of every required legal document. Frontend
 * detects 403 + `error: 'ConsentRequired'` and routes the user to the
 * re-consent screen.
 *
 * Wire as a global guard in app.module so every authenticated route is
 * protected by default; opt out via @SkipConsent() on consent endpoints
 * and any public path.
 */
@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: ConsentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CONSENT_META, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const { userId } = getRequestContext();
    if (!userId) {
      // No authenticated user = let auth guard reject this request earlier.
      return true;
    }

    const status = await this.service.getStatus(userId);
    if (status.data.allUpToDate) return true;

    const pending = status.data.documents.filter((d) => !d.isUpToDate);
    throw new ForbiddenException({
      statusCode: 403,
      error: 'ConsentRequired',
      message: 'User must accept the current legal documents to continue.',
      details: {
        pending: pending.map((d) => ({
          documentType: d.documentType,
          currentVersion: d.currentVersion,
          acceptedVersion: d.acceptedVersion,
        })),
      },
    });
  }
}
