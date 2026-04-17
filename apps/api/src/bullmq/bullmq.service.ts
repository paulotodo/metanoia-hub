import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type Processor } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { EnvConfig } from '../config/env.validation';

const QUEUE_PREFIX = 'queue';

@Injectable()
export class BullMqService implements OnModuleDestroy {
  private readonly connection: RedisOptions;
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(configService: ConfigService<EnvConfig, true>) {
    this.connection = {
      host: configService.get('REDIS_HOST', { infer: true }),
      port: configService.get('REDIS_PORT', { infer: true }),
      maxRetriesPerRequest: null,
    };
  }

  createQueue(name: string): Queue {
    const existing = this.queues.get(name);
    if (existing) return existing;

    const queue = new Queue(name, {
      connection: this.connection,
      prefix: QUEUE_PREFIX,
    });
    this.queues.set(name, queue);
    return queue;
  }

  createWorker(name: string, processor: Processor): Worker {
    const worker = new Worker(name, processor, {
      connection: this.connection,
      prefix: QUEUE_PREFIX,
    });
    this.workers.push(worker);
    return worker;
  }

  async onModuleDestroy() {
    await Promise.all([
      ...Array.from(this.queues.values()).map((q) => q.close()),
      ...this.workers.map((w) => w.close()),
    ]);
  }
}
