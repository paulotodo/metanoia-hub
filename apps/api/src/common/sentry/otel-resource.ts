/**
 * otel-resource.ts — OTel Resource with service identity (NFR-O5 / plan §2)
 *
 * Returns a Resource with semantic attributes identifying this service instance.
 * Statically reads the service version from package.json at module load time.
 */

import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Resource } from '@opentelemetry/resources';
import * as path from 'node:path';

// Resolve package.json relative to dist root (apps/api/), not the source file.
// Using path.resolve ensures correctness in both ts-node (src/) and compiled (dist/) contexts.
function readVersion(): string {
  try {
    // Walk up from this file to apps/api/ — works whether running from src/ or dist/
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require(pkgPath) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const SERVICE_VERSION = readVersion();

export interface OtelResourceEnv {
  OTEL_SERVICE_NAME?: string;
  NODE_ENV?: string;
}

export function buildOtelResource(env: OtelResourceEnv = process.env): Resource {
  return resourceFromAttributes({
    'service.name': env.OTEL_SERVICE_NAME ?? 'metanoia-api',
    'service.version': SERVICE_VERSION,
    'deployment.environment': env.NODE_ENV ?? 'development',
  });
}
