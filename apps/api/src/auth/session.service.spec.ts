import { Test } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from './session.service';
import { RedisService } from '../redis/redis.service';

describe('SessionService', () => {
  let service: SessionService;
  let redis: {
    set: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  const metadata = { ipAddress: '127.0.0.1', userAgent: 'test-agent' };

  beforeEach(async () => {
    redis = {
      set: vi.fn().mockResolvedValue('OK'),
      exists: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  it('should create a session in Redis with correct namespace', async () => {
    const sessionId = await service.create('user-id', 3600, metadata);

    expect(sessionId).toBeDefined();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^session:/),
      expect.stringContaining('"userId":"user-id"'),
      'EX',
      3600,
    );
  });

  it('should validate an existing session', async () => {
    redis.exists.mockResolvedValue(1);
    const result = await service.validate('session-id');
    expect(result).toBe(true);
    expect(redis.exists).toHaveBeenCalledWith('session:session-id');
  });

  it('should return false for non-existing session', async () => {
    redis.exists.mockResolvedValue(0);
    const result = await service.validate('non-existing');
    expect(result).toBe(false);
  });

  it('should destroy a session', async () => {
    await service.destroy('session-id');
    expect(redis.del).toHaveBeenCalledWith('session:session-id');
  });
});
