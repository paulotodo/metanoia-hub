import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Job, Queue, Worker } from 'bullmq';
import { BullMqService } from '../../bullmq/bullmq.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { KeycloakAdminService } from '../../auth/keycloak-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../auth/enums/role.enum';
import { HealthCheckService } from './health-check.service';
import { requestContext } from '../../common/context/request-context';
import { generateId } from '@metanoia/types';
import type { EnvConfig } from '../../config/env.validation';
import type { IntegrationHealthStatus } from '@metanoia/types';

const QUEUE_NAME = 'integration-health-check';
const JOB_NAME = 'integration-health-check';
/** 5 minutos em ms */
const INTERVAL_MS = 5 * 60 * 1000;
/** Redis lock TTL: 270s (4.5min — margem antes do próximo ciclo) */
const LOCK_TTL_SECONDS = 270;
const LOCK_KEY = 'rt:health-check:lock:integration';
const DEBOUNCE_KEY_PREFIX = 'rt:health-check:debounce:';
/** Debounce TTL: 30min */
const DEBOUNCE_TTL_SECONDS = 30 * 60;

interface DebounceState {
  status: string;
  consecutiveCount: number;
}

/**
 * IntegrationHealthProcessor — BullMQ worker periódico para health check.
 *
 * Story 14-4 §FR-005, §FR-006, §FR-007, §D-003, §D-004.
 *
 * Fluxo:
 *  1. Redis lock (NX EX 270) → single-execution em múltiplas instâncias
 *  2. Rodar probes via HealthCheckService.runAllProbes()
 *  3. Para cada integração: persistir em integration_health_log via createPrivilegedClient()
 *  4. Debounce anti-flapping: notificar apenas após 2 checks consecutivos com mesmo status (§D-004)
 *  5. Se notificar: emitir evento sistema.integration.status-changed + notificar Super Admins + audit
 *
 * NFR-TEST-001: em testes, TODAS as deps (Redis, Keycloak, Notif, Prisma) são mockadas.
 */
@Injectable()
export class IntegrationHealthProcessor implements OnModuleInit {
  private readonly logger = new Logger(IntegrationHealthProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly bullMqService: BullMqService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly healthCheckService: HealthCheckService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly keycloakAdminService: KeycloakAdminService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue = this.bullMqService.createQueue(QUEUE_NAME);
    this.worker = this.bullMqService.createWorker(
      QUEUE_NAME,
      async (job: Job) => this.dispatch(job),
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { jobId: job?.id, name: job?.name, error: err.message },
        'integration_health_check_failed',
      );
    });

    // Registrar job repeatable a cada 5 minutos (spec §FR-005 — BullMQ, não @nestjs/schedule)
    await this.queue.add(
      JOB_NAME,
      {},
      {
        repeat: { every: INTERVAL_MS },
        jobId: `${JOB_NAME}-scheduler`,
      },
    );
    this.logger.log('integration-health-check scheduler started (every 5min)');
  }

  private async dispatch(job: Job): Promise<void> {
    if (job.name !== JOB_NAME) return;
    await this.processHealthCheck();
  }

  private async processHealthCheck(): Promise<void> {
    const correlationId = generateId();

    // 1. Redis lock: single-execution em múltiplas instâncias (spec §D-003)
    const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!lock) {
      // Outra instância já está executando — ack silencioso
      this.logger.debug({ correlationId }, 'integration_health_check_lock_skip');
      return;
    }

    try {
      this.logger.log({ correlationId }, 'integration_health_check_started');

      // 2. Executar probes
      const items = await this.healthCheckService.runAllProbes();

      // 3. Persistir cada resultado + debounce
      for (const item of items) {
        await this.persistAndMaybeNotify(item.name, item.status, item.latencyMs, item.message ?? null, correlationId);
      }
    } catch (err) {
      this.logger.error(
        { correlationId, error: err instanceof Error ? err.message : 'unknown' },
        'integration_health_check_error',
      );
    }
    // Nota: lock expira automaticamente pelo Redis TTL (NX EX 270)
  }

  /**
   * Persiste o resultado da probe e, se debounce indicar, notifica Super Admins.
   */
  private async persistAndMaybeNotify(
    integrationName: string,
    status: IntegrationHealthStatus,
    latencyMs: number | null,
    message: string | null,
    correlationId: string,
  ): Promise<void> {
    const id = generateId();
    const checkedAt = new Date().toISOString();

    // 3. INSERT via createPrivilegedClient + bind params posicionais (CHK033, OWASP F3)
    const privileged = this.createPrivilegedClient();
    try {
      await privileged.$executeRawUnsafe(
        `INSERT INTO integration_health_log
           (id, integration_name, status, latency_ms, message, checked_at)
         VALUES ($1::uuid, $2, $3::integration_health_status, $4, $5, $6::timestamptz)`,
        id,
        integrationName,
        status,
        latencyMs,
        message,
        checkedAt,
      );
    } finally {
      await privileged.$disconnect();
    }

    // 4. Debounce anti-flapping (spec §D-004, §FR-006)
    const shouldNotify = await this.checkDebounce(integrationName, status);
    if (!shouldNotify) return;

    // 5. Notificar Super Admins
    await this.notifySuperAdmins(integrationName, status, correlationId);
  }

  /**
   * Lógica de debounce: retorna true somente quando status persiste >= 2 checks consecutivos.
   * Anti-flapping: evita notificações por mudanças transitórias (spec §D-004).
   */
  private async checkDebounce(integrationName: string, newStatus: IntegrationHealthStatus): Promise<boolean> {
    const key = `${DEBOUNCE_KEY_PREFIX}${integrationName}`;

    const raw = await this.redis.get(key);
    const state: DebounceState = raw
      ? (JSON.parse(raw) as DebounceState)
      : { status: newStatus, consecutiveCount: 0 };

    if (state.status !== newStatus) {
      // Status mudou: reset contador, iniciar contagem
      const newState: DebounceState = { status: newStatus, consecutiveCount: 1 };
      await this.redis.set(key, JSON.stringify(newState), 'EX', DEBOUNCE_TTL_SECONDS);
      return false; // Ainda não notificar
    }

    // Mesmo status: incrementar
    state.consecutiveCount += 1;
    await this.redis.set(key, JSON.stringify(state), 'EX', DEBOUNCE_TTL_SECONDS);

    // Notificar apenas na 2ª ocorrência consecutiva do mesmo status
    return state.consecutiveCount === 2;
  }

  /**
   * Resolve Super Admins via Keycloak e envia notificações individuais.
   */
  private async notifySuperAdmins(
    integrationName: string,
    status: IntegrationHealthStatus,
    correlationId: string,
  ): Promise<void> {
    // Buscar Super Admins no Keycloak
    let keycloakUsers: Awaited<ReturnType<KeycloakAdminService['getUsersByRealmRole']>>;
    try {
      keycloakUsers = await this.keycloakAdminService.getUsersByRealmRole(Role.SUPER_ADMIN);
    } catch (err) {
      this.logger.error({ error: err instanceof Error ? err.message : 'unknown' }, 'failed to fetch super admins');
      return;
    }

    if (keycloakUsers.length === 0) {
      this.logger.warn({ integrationName }, 'no_super_admins_found');
      return;
    }

    // Mapear keycloakId para userId local
    const keycloakIds = keycloakUsers.map((u) => u.id);
    let localUsers: Array<{ id: string; tenantId: string | null; keycloakId: string }>;
    try {
      localUsers = await this.prisma.client.$queryRawUnsafe<Array<{ id: string; tenantId: string | null; keycloakId: string }>>(
        `SELECT id::text, tenant_id::text AS "tenantId", keycloak_id AS "keycloakId"
         FROM users
         WHERE keycloak_id = ANY($1::text[])`,
        keycloakIds,
      );
    } catch (err) {
      this.logger.error({ error: err instanceof Error ? err.message : 'unknown' }, 'failed to fetch local super admin users');
      return;
    }

    // Emitir evento de domínio
    const eventId = generateId();
    const eventCorrelationId = generateId();
    this.logger.log(
      {
        eventId,
        correlationId: eventCorrelationId,
        integrationName,
        newStatus: status,
      },
      'system.integration.status-changed',
    );

    // Notificar cada Super Admin dentro de requestContext com seu tenantId
    for (const user of localUsers) {
      const requestId = generateId();
      const userTenantId = user.tenantId ?? 'platform';

      await requestContext.run(
        { tenantId: userTenantId, userId: 'system', requestId, correlationId: eventCorrelationId },
        async () => {
          try {
            await this.notificationsService.dispatch({
              userId: user.id,
              type: 'system',
              title: `Integração ${integrationName} — ${status}`,
              body: `O status da integração ${integrationName} mudou para ${status} e persistiu por 2 verificações consecutivas.`,
              channels: ['in_app'],
            });
          } catch (err) {
            this.logger.error(
              { userId: user.id, integrationName, error: err instanceof Error ? err.message : 'unknown' },
              'failed to dispatch health notification',
            );
          }
        },
      );
    }

    // Audit da notificação (§FR-007)
    void this.auditService.createEvent({
      userId: null,
      action: 'config_change',
      resource: 'integration_health',
      resourceId: integrationName,
      ipAddress: 'system',
      userAgent: 'health-check-worker',
      newState: { integrationName, newStatus: status, correlationId },
    });
  }

  /**
   * createPrivilegedClient — cliente BYPASSRLS para escrita em integration_health_log.
   * Padrão idêntico ao detect-evasion-risk.processor.ts.
   */
  private createPrivilegedClient(): PrismaClient {
    const connectionString = this.configService.get('DATABASE_URL', { infer: true });
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
  }
}
