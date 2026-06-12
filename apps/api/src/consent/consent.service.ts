import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { uuidv7 } from 'uuidv7';
import {
  type AcceptConsentInput,
  type AcceptConsentResponse,
  type ConsentDocumentStatus,
  type ConsentExportData,
  type ConsentHistoryItem,
  type ConsentHistoryResponse,
  type ConsentStatusResponse,
  type ConsentType,
  ConsentTypeSchema,
  MANDATORY_CONSENT_TYPES,
  type WithdrawConsentResponse,
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

// Map ConsentType -> ConsentDocumentType (1:1 for terms/privacy; not in Consent table for focus_monitoring)
const CONSENT_TYPE_TO_DOCUMENT_TYPE: Partial<Record<ConsentType, 'terms_of_service' | 'privacy_policy'>> = {
  terms_of_service: 'terms_of_service',
  privacy_policy: 'privacy_policy',
};

const ALL_CONSENT_TYPES: ConsentType[] = ConsentTypeSchema.options;

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

  /**
   * Returns the consolidated consent history for the authenticated user:
   * one ConsentHistoryItem per ConsentType, merging acceptances (consents table)
   * with withdrawals (consent_records table).
   */
  async getHistory(
    userId: string,
    tenantId: string | null,
  ): Promise<ConsentHistoryResponse> {
    const [acceptances, withdrawals] = await Promise.all([
      this.repo.findAllAcceptancesByUser(userId),
      this.repo.findWithdrawalsByUser(userId, tenantId),
    ]);

    // Index latest acceptance per document type
    const latestAcceptance = new Map<string, { acceptedAt: Date; version: string }>();
    for (const a of acceptances) {
      const existing = latestAcceptance.get(a.documentType);
      if (!existing || a.acceptedAt > existing.acceptedAt) {
        latestAcceptance.set(a.documentType, { acceptedAt: a.acceptedAt, version: a.version });
      }
    }

    // Index latest withdrawal per consent type
    const latestWithdrawal = new Map<string, Date>();
    for (const w of withdrawals) {
      const existing = latestWithdrawal.get(w.consentType);
      if (!existing || w.timestamp > existing) {
        latestWithdrawal.set(w.consentType, w.timestamp);
      }
    }

    const items: ConsentHistoryItem[] = ALL_CONSENT_TYPES.map((consentType) => {
      const isMandatory = (MANDATORY_CONSENT_TYPES as readonly string[]).includes(consentType);
      const docType = CONSENT_TYPE_TO_DOCUMENT_TYPE[consentType];
      const acceptance = docType ? latestAcceptance.get(docType) : undefined;
      const withdrawnAt = latestWithdrawal.get(consentType)?.toISOString() ?? null;

      // Determine status:
      // - withdrawn: most recent withdrawal exists and is after acceptance (or no acceptance)
      // - accepted: acceptance exists and is after any withdrawal (or no withdrawal)
      // - pending: neither acceptance nor withdrawal
      let status: 'accepted' | 'withdrawn' | 'pending';
      if (!acceptance && !withdrawnAt) {
        status = 'pending';
      } else if (!acceptance) {
        status = 'withdrawn';
      } else if (!withdrawnAt) {
        status = 'accepted';
      } else {
        const withdrawnDate = new Date(withdrawnAt);
        status = withdrawnDate > acceptance.acceptedAt ? 'withdrawn' : 'accepted';
      }

      return {
        consentType,
        status,
        isMandatory,
        acceptedAt: acceptance?.acceptedAt.toISOString() ?? null,
        acceptedVersion: acceptance?.version ?? null,
        withdrawnAt,
      };
    });

    return { data: items };
  }

  /**
   * Withdraws consent for a specific consent type.
   * Mandatory types (terms_of_service, privacy_policy) cannot be withdrawn.
   * Double-withdrawal is allowed (append-only, GAP-06).
   * Audit is handled automatically by the global AuditInterceptor (PATCH → WRITE_METHODS).
   */
  async withdrawConsent(
    userId: string,
    tenantId: string | null,
    consentType: ConsentType,
  ): Promise<WithdrawConsentResponse> {
    if ((MANDATORY_CONSENT_TYPES as readonly string[]).includes(consentType)) {
      throw new BadRequestException(
        `Consentimento obrigatório não pode ser revogado: ${consentType}`,
      );
    }

    const id = uuidv7();
    const record = await this.repo.createWithdrawal({
      id,
      userId,
      tenantId,
      consentType,
      action: 'withdrawn',
    });

    this.logger.log(
      `Consent withdrawn: user=${userId} type=${consentType} record=${record.id}`,
    );

    return {
      data: {
        recordId: record.id,
        consentType: record.consentType as ConsentType,
        action: 'withdrawn',
        withdrawnAt: record.timestamp.toISOString(),
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

  /**
   * Export consent data for a user.
   * Privileged — uses ConsentRepository which calls prisma.client directly. Never throws.
   */
  /**
   * Soft-delete for consents: NO-OP (LGPD art. 16 — legal basis requires retention).
   * Explicit stub so PrivacyDeletionService can call uniformly across all bounded contexts.
   */
  async softDeleteUserData(_userId: string, _tenantId: string): Promise<void> {
    // LGPD art. 16 — consents MUST be retained; this is intentionally a no-op
    // Tests assert that consent rows are NOT affected by soft-delete
  }

  /**
   * Hard-delete for consents: NO-OP (LGPD art. 16 — retained even after hard-delete).
   * Consent data is the legal record of user agreement — never deleted.
   */
  async hardDeleteUserData(_userId: string, _tenantId: string): Promise<void> {
    // LGPD art. 16 — consents MUST be retained
  }

  async exportConsentData(userId: string, tenantId: string): Promise<ConsentExportData> {
    const [acceptances, withdrawals] = await Promise.all([
      this.repo.findAllAcceptancesByUser(userId),
      this.repo.findWithdrawalsByUser(userId, tenantId),
    ]);

    return {
      acceptances: acceptances.map((a) => ({
        documentType: a.documentType,
        version: a.version,
        acceptedAt: a.acceptedAt.toISOString(),
      })),
      withdrawals: withdrawals.map((w) => ({
        consentType: w.consentType,
        timestamp: w.timestamp.toISOString(),
      })),
    };
  }
}
