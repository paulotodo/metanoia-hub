/**
 * instrumentation.ts — Next.js 16 OpenTelemetry instrumentation (FR-10, FR-11)
 *
 * Spec §FR-10, FR-11, plan §5 D-02, checklist CHK050.
 * Next.js 16.2 supports instrumentation.ts natively (no experimental flag needed).
 *
 * Strategy: no-op safe (lição 14-3 — env var absent must not block build/E2E).
 * When OTEL_EXPORTER_OTLP_ENDPOINT is absent and OTEL_TRACES_EXPORTER !== 'console',
 * register() returns early without creating any TracerProvider.
 *
 * Note: @vercel/otel not available in this installation (checked via ls).
 * Using manual @opentelemetry SDK setup as fallback (plan §6.1.4 fallback path).
 */

export async function register(): Promise<void> {
  // Only run on Node.js runtime (not edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const exporter = process.env.OTEL_TRACES_EXPORTER ?? 'otlp';

  // No-op: when no endpoint and not console mode (FR-01 / lição 14-3)
  if (!endpoint && exporter !== 'console') {
    return;
  }

  // Lazy import to avoid any module-level side effects during normal builds
  try {
    const { NodeSDK } = await import(
      '@opentelemetry/sdk-node' as string
    ).catch(() => ({ NodeSDK: null }));

    if (!NodeSDK) {
      // @opentelemetry/sdk-node not installed — graceful no-op
      return;
    }

    const { OTLPTraceExporter } = await import(
      '@opentelemetry/exporter-trace-otlp-http' as string
    );
    const { resourceFromAttributes } = await import(
      '@opentelemetry/resources' as string
    );

    const resource = resourceFromAttributes({
      'service.name':
        process.env.OTEL_SERVICE_NAME ?? 'metanoia-web',
      'deployment.environment':
        process.env.NODE_ENV ?? 'development',
    });

    const sdk = new NodeSDK({
      resource,
      ...(endpoint
        ? { traceExporter: new OTLPTraceExporter({ url: endpoint }) }
        : {}),
    });

    sdk.start();
  } catch {
    // Instrumentation must NEVER throw — graceful no-op on any failure
    // This includes missing packages, network issues, etc.
  }
}
