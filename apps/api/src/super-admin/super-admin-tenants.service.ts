import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  generateId,
  type ProvisionStatusData,
  type ProvisionTenantInput,
  type TenantDetail,
  type TenantPatchInput,
  type TenantPlan,
  type TenantStatus,
  type TenantSummary,
  type TenantsListQuery,
  type TenantsListResponse,
} from '@metanoia/types';
import { SuperAdminTenantsRepository } from './super-admin-tenants.repository';

interface SagaState {
  step: 1 | 2 | 3;
  status: 'running' | 'done' | 'failed';
  failedAt: 'db' | 'keycloak' | 'invite' | null;
  error: string | null;
}

const ALLOWED_STATUS_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  active: ['suspended'],
  suspended: ['active'],
  provisioning: [],
  provisioning_failed: [],
};

/**
 * SuperAdminTenantsService — orchestrates the cross-tenant operations exposed
 * to the super_admin role. Saga state lives on the Tenant row itself (the
 * `provisioning_state` JSONB column) so polling endpoints stay stateless.
 *
 * Veto permanente: este serviço NUNCA retorna dados pastorais individuais.
 * `aggregates` retorna apenas counts — quem precisa do dado pastoral é o
 * AdminTenant ou o LeaderRadar, ambos com guards próprios.
 */
@Injectable()
export class SuperAdminTenantsService {
  private readonly logger = new Logger(SuperAdminTenantsService.name);

  constructor(private readonly repo: SuperAdminTenantsRepository) {}

  async list(query: TenantsListQuery): Promise<TenantsListResponse> {
    const { rows, total, memberCounts } = await this.repo.list({
      page: query.page,
      limit: query.limit,
      status: query.status,
      plan: query.plan,
      search: query.search,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    });

    const data: TenantSummary[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug ?? row.id,
      plan: row.plan as TenantPlan,
      status: row.status as TenantStatus,
      memberCount: memberCounts.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async detail(id: string): Promise<{ data: TenantDetail }> {
    const tenant = await this.repo.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const aggregates = await this.repo.aggregates(id);

    const data: TenantDetail = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug ?? tenant.id,
      plan: tenant.plan as TenantPlan,
      status: tenant.status as TenantStatus,
      createdAt: tenant.createdAt.toISOString(),
      adminEmail: tenant.adminEmail ?? 'unknown@example.com',
      inviteStatus: 'sent', // TODO Sprint 2: derive from Keycloak invite state
      memberCount: aggregates.memberCount,
      groupCount: aggregates.groupCount,
      leaderCount: aggregates.leaderCount,
    };

    return { data };
  }

  async provision(
    input: ProvisionTenantInput,
  ): Promise<{ data: { tenantId: string; status: TenantStatus } }> {
    const conflict = await this.repo.findBySlug(input.slug);
    if (conflict) {
      throw new ConflictException('Slug already exists');
    }

    const id = generateId();
    await this.repo.create({
      id,
      name: input.name.trim(),
      slug: input.slug.trim(),
      plan: input.plan,
      adminEmail: input.adminEmail.trim(),
    });

    // Saga step 1 already done (DB row created). Kick off remaining steps
    // asynchronously; the status endpoint reads `provisioning_state` for
    // polling. Mock Keycloak/invite for MVP — real integration arrives with
    // the Keycloak realm provisioner (Sprint 2 backlog).
    void this.runSaga(id);

    return { data: { tenantId: id, status: 'provisioning' } };
  }

  async getProvisionStatus(
    id: string,
  ): Promise<{ data: ProvisionStatusData }> {
    const tenant = await this.repo.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const state =
      (tenant.provisioningState as SagaState | null) ??
      ({
        step: 3,
        status: tenant.status === 'active' ? 'done' : 'running',
        failedAt: null,
        error: null,
      } satisfies SagaState);

    return { data: state };
  }

  async patch(
    id: string,
    input: TenantPatchInput,
  ): Promise<{ data: TenantDetail }> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Tenant not found');

    if (input.status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[current.status as TenantStatus];
      if (!allowed.includes(input.status as TenantStatus)) {
        throw new ConflictException(
          `Cannot transition from ${current.status} to ${input.status}`,
        );
      }
      await this.repo.updateStatus(id, input.status);
      // TODO Sprint 2: when suspending, invalidate Keycloak sessions for the tenant.
      this.logger.log(
        `Tenant ${id} status changed from ${current.status} to ${input.status}`,
      );
    }

    if (input.name) {
      await this.repo.updateName(id, input.name.trim());
    }

    return this.detail(id);
  }

  async retry(id: string): Promise<{ data: { tenantId: string; status: TenantStatus } }> {
    const tenant = await this.repo.findById(id);
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status !== 'provisioning_failed') {
      throw new ConflictException(
        `Tenant is in status ${tenant.status}, retry only allowed for provisioning_failed`,
      );
    }
    await this.repo.updateStatus(id, 'provisioning');
    await this.repo.setProvisioningState(id, {
      step: 1,
      status: 'running',
      failedAt: null,
      error: null,
    });
    void this.runSaga(id);
    return { data: { tenantId: id, status: 'provisioning' } };
  }

  /**
   * Saga executor. MVP runs synchronously after a small delay; future work
   * moves this to a BullMQ job to survive process restarts.
   */
  private async runSaga(id: string): Promise<void> {
    try {
      // Step 1 — DB row already exists (created in provision()).
      await this.repo.setProvisioningState(id, {
        step: 1,
        status: 'done',
        failedAt: null,
        error: null,
      });

      // Step 2 — Keycloak realm + admin user (mocked in MVP).
      await this.repo.setProvisioningState(id, {
        step: 2,
        status: 'running',
        failedAt: null,
        error: null,
      });
      this.logger.log(`Saga step 2 (Keycloak) running for tenant ${id} — mocked`);

      // Step 3 — invite email (mocked in MVP).
      await this.repo.setProvisioningState(id, {
        step: 3,
        status: 'running',
        failedAt: null,
        error: null,
      });
      this.logger.log(`Saga step 3 (invite) running for tenant ${id} — mocked`);

      // Saga complete.
      await this.repo.updateStatus(id, 'active');
      await this.repo.setProvisioningState(id, {
        step: 3,
        status: 'done',
        failedAt: null,
        error: null,
      });
      this.logger.log(`Saga complete for tenant ${id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      await this.repo.updateStatus(id, 'provisioning_failed');
      await this.repo.setProvisioningState(id, {
        step: 2,
        status: 'failed',
        failedAt: 'keycloak',
        error: message,
      });
      this.logger.error(`Saga failed for tenant ${id}: ${message}`);
    }
  }
}
