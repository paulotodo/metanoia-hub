/**
 * EmailHealthPort — abstraction for checking Resend/SMTP health.
 *
 * INTEGRATION POINT (Story 14-4): replace StubEmailHealthPort with a real
 * implementation that performs liveness probes against the Resend API.
 * The EmailCircuitBreakerService injects this via EMAIL_HEALTH_PORT token.
 *
 * SC-07: callers depend on the interface, not the concrete class.
 * Swapping the provider does NOT require changes to EmailChannel or EmailCircuitBreakerService.
 */
export interface EmailHealthPort {
  /**
   * Returns true if the email provider is considered healthy and available.
   * Implementations MUST NOT throw — return false on any error.
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Injection token for EmailHealthPort.
 * Use in providers array: { provide: EMAIL_HEALTH_PORT, useClass: StubEmailHealthPort }
 */
export const EMAIL_HEALTH_PORT = 'EMAIL_HEALTH_PORT' as const;

/**
 * StubEmailHealthPort — always returns healthy.
 *
 * Used until Story 14-4 (real health-check implementation).
 * Circuit breaker still operates on firstFailureAt timing (L3/spec §FR-13) —
 * it does NOT rely solely on isHealthy() to open. See EmailCircuitBreakerService.
 */
export class StubEmailHealthPort implements EmailHealthPort {
  async isHealthy(): Promise<boolean> {
    // INTEGRATION POINT (Story 14-4): replace with real probe.
    return true;
  }
}
