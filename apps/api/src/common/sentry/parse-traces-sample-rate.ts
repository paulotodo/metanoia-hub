const PROD_DEFAULT = 0.2;
const NON_PROD_DEFAULT = 1.0;

export function parseTracesSampleRate(
  env: NodeJS.ProcessEnv = process.env,
  warn: (msg: string) => void = console.warn,
): number {
  const fallback =
    env.NODE_ENV === 'production' ? PROD_DEFAULT : NON_PROD_DEFAULT;
  const raw = env.SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    warn(
      `[Sentry] Invalid SENTRY_TRACES_SAMPLE_RATE="${raw}" — using fallback ${fallback}`,
    );
    return fallback;
  }
  return parsed;
}
