/**
 * email-metrics.constants.ts — Metric names for the email notification channel.
 *
 * These constants define the contract for observability instrumentation.
 * They are decoupled from any specific metrics library (Prometheus/OpenTelemetry)
 * to allow future integration without changing the call sites.
 *
 * TODO: instrumentar com Prometheus counters/histograms quando feature de métricas for implementada.
 * See: checklists/performance.md CHK055, task 8.2.1.
 *
 * Usage (future):
 *   metricsService.counter(EMAIL_SEND_SUCCESS, { type, tenantId }).increment();
 *   metricsService.histogram(EMAIL_SEND_DURATION, { type }).observe(durationMs);
 */

/** Incremented on every successful Resend API delivery. */
export const EMAIL_SEND_SUCCESS = 'email.send.success' as const;

/** Incremented on every failed delivery attempt (retryable or permanent). */
export const EMAIL_SEND_FAILURE = 'email.send.failure' as const;

/** Incremented when a notification is deferred due to rate limiting. */
export const EMAIL_RATE_LIMIT_DEFERRED = 'email.rate_limit.deferred' as const;

/** Incremented when the circuit breaker transitions from closed → open. */
export const EMAIL_CIRCUIT_OPEN = 'email.circuit_open' as const;

/**
 * Histogram of end-to-end email delivery duration (ms) from send attempt to Resend response.
 * Buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000] ms.
 * TODO: instrumentar com Prometheus counters/histograms quando feature de métricas for implementada.
 */
export const EMAIL_SEND_DURATION = 'email.send.duration' as const;
