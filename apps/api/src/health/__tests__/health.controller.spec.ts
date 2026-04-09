import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from '../health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const mockPrisma = {
  $queryRaw: vi.fn(),
};

const mockRedis = {
  ping: vi.fn(),
};

const mockConfig = {
  get: vi.fn((key: string) => {
    const map: Record<string, string> = {
      KEYCLOAK_URL: 'http://localhost:8080',
      MINIO_ENDPOINT: 'http://localhost:9000',
    };
    return map[key];
  }),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    vi.restoreAllMocks();

    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should return ok when all services are healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.check(res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'ok',
      version: '1.0.0',
      checks: {
        database: 'ok',
        redis: 'ok',
        keycloak: 'ok',
        storage: 'ok',
      },
    });

    fetchSpy.mockRestore();
  });

  it('should return degraded when database is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    mockRedis.ping.mockResolvedValue('PONG');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.check(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({ database: 'error' }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('should return degraded when redis is down', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockRejectedValue(new Error('connection refused'));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.check(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({ redis: 'error' }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('should return degraded when keycloak is unreachable', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('8080')) throw new Error('keycloak down');
        return new Response(null, { status: 200 });
      },
    );

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.check(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({ keycloak: 'error' }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it('should return degraded when minio is unreachable', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        if (urlStr.includes('9000')) throw new Error('minio down');
        return new Response(null, { status: 200 });
      },
    );

    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await controller.check(res as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'degraded',
        checks: expect.objectContaining({ storage: 'error' }),
      }),
    );

    fetchSpy.mockRestore();
  });
});
