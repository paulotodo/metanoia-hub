import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express, { type Express } from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { RequestContextMiddleware } from '../../src/common/context/request-context.middleware';

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('RequestContextMiddleware integration — response headers', () => {
  let app: Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const middleware = new RequestContextMiddleware();
    app = express();
    app.use((req, res, next) => middleware.use(req as any, res as any, next));
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });
    app.get('/boom', (_req, _res) => {
      throw new Error('simulated failure');
    });

    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sets X-Request-Id in UUID v7 shape on successful response', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    const requestId = response.headers.get('x-request-id');
    expect(requestId).toBeTruthy();
    expect(requestId).toMatch(UUID_V7_PATTERN);
  });

  it('sets X-Correlation-Id mirroring requestId when no header was provided', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const requestId = response.headers.get('x-request-id');
    const correlationId = response.headers.get('x-correlation-id');
    expect(correlationId).toBe(requestId);
  });

  it('mirrors sanitized x-correlation-id provided by the client', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { 'x-correlation-id': 'client-corr-abc-123' },
    });
    expect(response.headers.get('x-correlation-id')).toBe('client-corr-abc-123');
    expect(response.headers.get('x-request-id')).toMatch(UUID_V7_PATTERN);
  });

  it('generates a distinct X-Request-Id per request', async () => {
    const [a, b] = await Promise.all([
      fetch(`${baseUrl}/health`),
      fetch(`${baseUrl}/health`),
    ]);
    const idA = a.headers.get('x-request-id');
    const idB = b.headers.get('x-request-id');
    expect(idA).toBeTruthy();
    expect(idB).toBeTruthy();
    expect(idA).not.toBe(idB);
  });
});
