import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailHealthPort } from '../../notifications/ports/email-health.port';
import type { EnvConfig } from '../../config/env.validation';

/**
 * ResendHealthPort — implementação real de EmailHealthPort (Story 14-4 §FR-008, §D-002).
 *
 * Substitui StubEmailHealthPort em NotificationsModule (task 2.2).
 * Alimenta EmailCircuitBreakerService da Story 14-3 com probe real.
 *
 * Lógica:
 *  - GET https://api.resend.com/domains com Bearer token e AbortSignal.timeout(5000)
 *  - 2xx ou 4xx → true (conectividade OK; 401/403 = API key issue, mas Resend está up)
 *  - 5xx, timeout, network error → false
 *
 * Segurança:
 *  - RESEND_API_KEY via ConfigService — NUNCA hardcodado ou logado (CHK028)
 *  - Nenhum valor de env var aparece em logs ou respostas (CHK030)
 *  - Implementação MUST NOT throw — retorna false em qualquer erro (interface contract)
 */
@Injectable()
export class ResendHealthPort implements EmailHealthPort {
  private readonly logger = new Logger(ResendHealthPort.name);

  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  async isHealthy(): Promise<boolean> {
    const apiKey = this.configService.get('RESEND_API_KEY', { infer: true });

    try {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      // 2xx → healthy; 4xx → conectividade confirmada (auth issue, não infra)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return true;
      }

      // 5xx → Resend com problema
      this.logger.warn(
        { statusCode: response.status },
        'resend_health_probe_server_error',
      );
      return false;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      const isAbort = err instanceof Error && err.name === 'AbortError';

      if (isTimeout || isAbort) {
        this.logger.warn('resend_health_probe_timeout');
      } else {
        // Logar apenas o tipo de erro — NUNCA o valor de apiKey nem URLs internas
        const errType = err instanceof Error ? err.constructor.name : 'UnknownError';
        this.logger.warn({ errType }, 'resend_health_probe_network_error');
      }
      return false;
    }
  }
}
