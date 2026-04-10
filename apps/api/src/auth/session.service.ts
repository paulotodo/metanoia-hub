import { Injectable, Logger } from '@nestjs/common';
import { generateId } from '@metanoia/types';
import { RedisService } from '../redis/redis.service';

interface SessionMetadata {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly redis: RedisService) {}

  async create(userId: string, expiresIn: number, metadata: SessionMetadata): Promise<string> {
    const sessionId = generateId();

    await this.redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        createdAt: new Date().toISOString(),
      }),
      'EX',
      expiresIn,
    );

    this.logger.log({ userId, sessionId }, 'session created');
    return sessionId;
  }

  async validate(sessionId: string): Promise<boolean> {
    const exists = await this.redis.exists(`session:${sessionId}`);
    return exists === 1;
  }

  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
    this.logger.log({ sessionId }, 'session destroyed');
  }
}
