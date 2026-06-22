import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { IntegrationHealthItem, IntegrationHealthSummary } from '@metanoia/types';

/**
 * Thresholds de classificação de latência (spec §FR-002, §NFR-I5)
 * healthy  < 1000ms
 * degraded = 1000-5000ms
 * unhealthy > 5000ms ou qualquer erro/timeout
 */
const HEALTHY_THRESHOLD_MS = 1000;
const DEGRADED_THRESHOLD_MS = 5000;
const PROBE_TIMEOUT_MS = 5000;
const REDIS_TIMEOUT_MS = 3000;
const PG_TIMEOUT_MS = 3000;

/**
 * Allowlist canônica de mensagens de erro.
 * NUNCA incluir valores de env vars (URLs, API keys, hosts) — CHK028/CHK030.
 */
const MSG = {
  TIMEOUT: 'timeout',
  CONNECTION_REFUSED: 'connection refused',
  API_KEY_INVALID: 'api key invalid — connectivity confirmed',
  UNKNOWN_ERROR: 'unknown error',
} as const;

function classifyLatency(ms: number): 'healthy' | 'degraded' | 'unhealthy' {
  if (ms < HEALTHY_THRESHOLD_MS) return 'healthy';
  if (ms <= DEGRADED_THRESHOLD_MS) return 'degraded';
  return 'unhealthy';
}

function isTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'TimeoutError' || err.name === 'AbortError';
}

/**
 * HealthCheckService — executa as 5 probes de integração em paralelo.
 *
 * Story 14-4 §FR-002, §NFR-I5, §D-002.
 * Usa Promise.allSettled (não Promise.all) para garantir que falha de uma
 * probe não cancela as demais.
 *
 * Segurança (CHK028/CHK030):
 *  - message usa apenas valores da allowlist MSG
 *  - NUNCA inclui valores de KEYCLOAK_URL, MINIO_ENDPOINT, RESEND_API_KEY
 */
@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);

  constructor(
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async runAllProbes(): Promise<IntegrationHealthItem[]> {
    const now = new Date().toISOString();

    const results = await Promise.allSettled([
      this.probeResend(now),
      this.probeKeycloak(now),
      this.probeMinIO(now),
      this.probeRedis(now),
      this.probePostgres(now),
    ]);

    return results.map((r) => {
      if (r.status === 'fulfilled') return r.value;
      // Promise.allSettled não deve rejeitar porque cada probe captura seus erros
      // mas caso ocorra, retornar unhealthy defensivamente
      this.logger.error({ reason: r.reason }, 'probe_unexpected_rejection');
      return {
        name: 'unknown',
        status: 'unhealthy' as const,
        latencyMs: null,
        lastChecked: new Date().toISOString(),
        message: MSG.UNKNOWN_ERROR,
      };
    });
  }

  computeSummary(items: IntegrationHealthItem[]): IntegrationHealthSummary {
    return {
      total: items.length,
      healthy: items.filter((i) => i.status === 'healthy').length,
      degraded: items.filter((i) => i.status === 'degraded').length,
      unhealthy: items.filter((i) => i.status === 'unhealthy').length,
    };
  }

  // ---------------------------------------------------------------------------
  // Probes individuais
  // ---------------------------------------------------------------------------

  /** Probe Resend: GET /domains — 2xx/4xx = conectividade OK */
  private async probeResend(lastChecked: string): Promise<IntegrationHealthItem> {
    const apiKey = this.configService.get('RESEND_API_KEY', { infer: true });
    const start = performance.now();

    try {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        const message = response.status === 401 || response.status === 403
          ? MSG.API_KEY_INVALID
          : undefined;
        return { name: 'Resend', status: classifyLatency(latencyMs), latencyMs, lastChecked, message };
      }

      // 5xx
      return { name: 'Resend', status: 'unhealthy', latencyMs, lastChecked, message: MSG.UNKNOWN_ERROR };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message = isTimeoutError(err) ? MSG.TIMEOUT : MSG.CONNECTION_REFUSED;
      return { name: 'Resend', status: 'unhealthy', latencyMs: null, lastChecked, message };
    }
  }

  /**
   * Probe Keycloak: GET /.well-known/openid-configuration
   * CHK030: NUNCA expor KEYCLOAK_URL no campo message
   */
  private async probeKeycloak(lastChecked: string): Promise<IntegrationHealthItem> {
    const url = this.configService.get('KEYCLOAK_URL', { infer: true });
    const realm = this.configService.get('KEYCLOAK_REALM', { infer: true });
    const endpoint = `${url}/realms/${realm}/.well-known/openid-configuration`;
    const start = performance.now();

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });

      const latencyMs = Math.round(performance.now() - start);
      const status = response.ok ? classifyLatency(latencyMs) : 'unhealthy';
      const message = response.ok ? undefined : MSG.UNKNOWN_ERROR;
      return { name: 'Keycloak', status, latencyMs, lastChecked, message };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      // CHK030: NUNCA incluir `url` ou `endpoint` no message
      const message = isTimeoutError(err) ? MSG.TIMEOUT : MSG.CONNECTION_REFUSED;
      return { name: 'Keycloak', status: 'unhealthy', latencyMs: null, lastChecked, message };
    }
  }

  /**
   * Probe MinIO: HEAD /minio/health/live
   * CHK030: NUNCA expor MINIO_ENDPOINT no campo message
   */
  private async probeMinIO(lastChecked: string): Promise<IntegrationHealthItem> {
    const endpoint = this.configService.get('MINIO_ENDPOINT', { infer: true });
    const url = `${endpoint}/minio/health/live`;
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });

      const latencyMs = Math.round(performance.now() - start);
      const status = response.ok ? classifyLatency(latencyMs) : 'unhealthy';
      const message = response.ok ? undefined : MSG.UNKNOWN_ERROR;
      return { name: 'MinIO', status, latencyMs, lastChecked, message };
    } catch (err) {
      // CHK030: NUNCA incluir `endpoint` ou `url` no message
      const message = isTimeoutError(err) ? MSG.TIMEOUT : MSG.CONNECTION_REFUSED;
      return { name: 'MinIO', status: 'unhealthy', latencyMs: null, lastChecked, message };
    }
  }

  /** Probe Redis: PING com timeout de 3s */
  private async probeRedis(lastChecked: string): Promise<IntegrationHealthItem> {
    const start = performance.now();

    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), REDIS_TIMEOUT_MS),
        ),
      ]);

      const latencyMs = Math.round(performance.now() - start);
      if (pong === 'PONG') {
        return { name: 'Redis', status: classifyLatency(latencyMs), latencyMs, lastChecked };
      }
      return { name: 'Redis', status: 'unhealthy', latencyMs, lastChecked, message: MSG.UNKNOWN_ERROR };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const message = isTimeoutError(err) ? MSG.TIMEOUT : MSG.CONNECTION_REFUSED;
      return { name: 'Redis', status: 'unhealthy', latencyMs: null, lastChecked, message };
    }
  }

  /** Probe PostgreSQL: SELECT 1 com timeout de 3s */
  private async probePostgres(lastChecked: string): Promise<IntegrationHealthItem> {
    const start = performance.now();

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), PG_TIMEOUT_MS),
        ),
      ]);

      const latencyMs = Math.round(performance.now() - start);
      return { name: 'PostgreSQL', status: classifyLatency(latencyMs), latencyMs, lastChecked };
    } catch (err) {
      const message = isTimeoutError(err) ? MSG.TIMEOUT : MSG.CONNECTION_REFUSED;
      return { name: 'PostgreSQL', status: 'unhealthy', latencyMs: null, lastChecked, message };
    }
  }
}
