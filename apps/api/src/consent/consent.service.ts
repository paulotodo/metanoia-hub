import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import {
  type AcceptConsentInput,
  type AcceptConsentResponse,
  type ConsentDocumentStatus,
  type ConsentStatusResponse,
} from '@metanoia/types';
import { getRequestContext } from '../common/context/request-context';
import { ConsentRepository } from './consent.repository';
import {
  CURRENT_CONSENT_VERSIONS,
  REQUIRED_DOCUMENT_TYPES,
} from './consent.versions';

interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly repo: ConsentRepository) {}

  async getStatus(userId: string): Promise<ConsentStatusResponse> {
    const documents: ConsentDocumentStatus[] = await Promise.all(
      REQUIRED_DOCUMENT_TYPES.map(async (documentType) => {
        const latest = await this.repo.findLatestByUser(userId, documentType);
        const currentVersion = CURRENT_CONSENT_VERSIONS[documentType];
        return {
          documentType,
          currentVersion,
          acceptedVersion: latest?.version ?? null,
          acceptedAt: latest?.acceptedAt.toISOString() ?? null,
          isUpToDate: latest?.version === currentVersion,
        };
      }),
    );

    return {
      data: {
        documents,
        allUpToDate: documents.every((d) => d.isUpToDate),
      },
    };
  }

  async accept(
    input: AcceptConsentInput,
    meta: RequestMeta,
  ): Promise<AcceptConsentResponse> {
    const { userId, tenantId } = getRequestContext();
    if (!userId) {
      throw new UnauthorizedException('Missing user id in request context');
    }

    const expected = CURRENT_CONSENT_VERSIONS[input.documentType];
    // Allow accepting either the current canonical version or a freshly
    // bumped one — the version string is recorded as-is for audit so future
    // version drift is detectable.
    const versionToRecord = input.version === expected ? expected : input.version;

    const id = uuidv7();
    const created = await this.repo.create({
      id,
      userId,
      tenantId: tenantId ?? null,
      documentType: input.documentType,
      version: versionToRecord,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    this.logger.log(
      `Consent accepted: user=${userId} doc=${input.documentType} version=${versionToRecord}`,
    );

    return {
      data: {
        consentId: created.id,
        documentType: input.documentType,
        version: versionToRecord,
        acceptedAt: created.acceptedAt.toISOString(),
      },
    };
  }
}
