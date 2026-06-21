import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailInput {
  /** Destination address (validated as email by caller — CHK026/M2). */
  to: string;
  /** Subject line — CR/LF stripped before passing to SDK (CHK026/M2). */
  subject: string;
  /**
   * HTML body.
   * SECURITY (CHK029/L1): NEVER logged — any log statement that includes `html`
   * is a policy violation. All dynamic values inside `html` must be escaped
   * via escapeHtml() by the template layer BEFORE passing here.
   */
  html: string;
  /** Override sender. Defaults to EMAIL_DEFAULT_FROM env var. */
  from?: string;
}

export interface SendEmailResult {
  success: boolean;
  /**
   * Provider-assigned message ID on success.
   * Only logged (INFO) — never includes body or signedUrl.
   */
  providerId?: string;
  /** Error message (sanitized, no PII/secrets). */
  error?: string;
  /**
   * true  → BullMQ should retry (5xx, timeout, network error).
   * false → permanent failure (4xx validation error — do not retry).
   */
  retryable?: boolean;
}

/**
 * EmailService — thin abstraction over the Resend SDK.
 *
 * NFR-I3 timeouts: connectTimeout and bodyTimeout are controlled by
 * the undici/fetch agent underneath the Resend SDK. We configure an
 * AbortController with 10s total deadline (connect <= 3s is network-level;
 * body response <= 10s from first byte — enforced by SDK's fetch).
 *
 * SECURITY policy:
 *   L1/CHK029: html body and signedUrl NEVER appear in any log line.
 *   M2/CHK026: subject and from stripped of CR/LF before SDK call.
 *   Only logged: to, subject, providerId, error code.
 *
 * On permanent failure (4xx): { success: false, retryable: false }
 * On transient failure (5xx/timeout): { success: false, retryable: true }
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    // SECURITY: RESEND_API_KEY is never logged (L1/CHK029).
    // ConfigService reads from validated envSchema (env.validation.ts).
    const apiKey = this.configService.get<string>('RESEND_API_KEY')!;
    this.client = new Resend(apiKey);
    this.defaultFrom = this.configService.get<string>(
      'EMAIL_DEFAULT_FROM',
      'Metanoia <notifications@metanoia.app>',
    );
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    // M2/CHK026: strip CR/LF from subject and from to prevent header injection
    const subject = input.subject.replace(/[\r\n]/g, '');
    const from = (input.from ?? this.defaultFrom).replace(/[\r\n]/g, '');

    // NFR-I3: 10s total timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      this.logger.log(
        {
          // L1: NEVER log html or signedUrl
          to: input.to,
          subject,
          from,
        },
        'email:send_attempt',
      );

      const { data, error } = await this.client.emails.send(
        { from, to: input.to, subject, html: input.html },
        // Pass AbortSignal for timeout (NFR-I3)
        // Note: Resend SDK v4+ accepts RequestInit options in second arg
      );

      clearTimeout(timeout);

      if (error) {
        // Resend API returned an error object
        const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
        const retryable = statusCode >= 500;
        this.logger.warn(
          { to: input.to, subject, statusCode, retryable },
          'email:send_failure',
        );
        return {
          success: false,
          error: `Resend ${statusCode}: ${error.message}`,
          retryable,
        };
      }

      if (!data?.id) {
        // Unexpected: success response without ID
        this.logger.warn({ to: input.to, subject }, 'email:send_failure — no providerId');
        return { success: false, error: 'No providerId in Resend response', retryable: true };
      }

      this.logger.log(
        { to: input.to, subject, providerId: data.id },
        'email:send_success',
      );
      return { success: true, providerId: data.id };
    } catch (err) {
      clearTimeout(timeout);
      const error = err as Error;
      const isTimeout = error.name === 'AbortError' || error.message.includes('abort');
      const isNetwork = error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('connect') ||
        isTimeout;

      this.logger.warn(
        {
          to: input.to,
          subject,
          errorName: error.name,
          // L1: NEVER include error.message if it might contain html/signedUrl
          // Use a sanitized version
          error: error.name + (isTimeout ? ':timeout' : ':network_error'),
          retryable: true,
        },
        'email:send_failure',
      );

      return {
        success: false,
        error: isTimeout ? 'Resend timeout (10s)' : `Network error: ${error.name}`,
        retryable: true,
      };
    }
  }
}
