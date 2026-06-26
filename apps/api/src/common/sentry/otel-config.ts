/**
 * otel-config.ts — OpenTelemetry mode resolution (NFR-O5 / tracing-distribuido-opentelemetry)
 *
 * Decision table (spec §FR-01, FR-02, plan §2):
 *
 * | OTEL_TRACES_EXPORTER | OTEL_EXPORTER_OTLP_ENDPOINT | NODE_ENV    | mode     |
 * |----------------------|-----------------------------|-------------|----------|
 * | 'none'               | any                         | any         | noop     |
 * | 'console'            | any                         | production  | noop (*) |
 * | 'console'            | any                         | non-prod    | console  |
 * | 'otlp'               | absent / undefined          | any         | noop     |
 * | 'otlp'               | present                     | any         | otlp     |
 *
 * (*) console in production: log warning + fallback to noop to avoid stdout leakage (CHK047).
 */

export type OtelMode = 'otlp' | 'console' | 'noop';

export interface OtelConfig {
  mode: OtelMode;
  endpoint?: string;
}

export interface OtelConfigEnv {
  OTEL_TRACES_EXPORTER?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  NODE_ENV?: string;
}

/**
 * Resolve the OTel operating mode from environment variables.
 * Pure function — no side effects, no process.env access.
 * Caller passes env (defaults to process.env for production use).
 */
export function resolveOtelConfig(
  env: OtelConfigEnv = process.env,
  warn: (msg: string) => void = console.warn,
): OtelConfig {
  const exporter = env.OTEL_TRACES_EXPORTER ?? 'otlp';
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const isProd = (env.NODE_ENV ?? 'development') === 'production';

  // Explicit no-op
  if (exporter === 'none') {
    return { mode: 'noop' };
  }

  // Console exporter: blocked in production (CHK047)
  if (exporter === 'console') {
    if (isProd) {
      warn(
        'OTel: console exporter ativo em production — risco de vazamento de dados no stdout. ' +
          'Defina OTEL_TRACES_EXPORTER=otlp ou none.',
      );
      return { mode: 'noop' };
    }
    return { mode: 'console' };
  }

  // OTLP: requires endpoint; without it → no-op (FR-01: safe boot without env)
  if (!endpoint) {
    return { mode: 'noop' };
  }

  return { mode: 'otlp', endpoint };
}
