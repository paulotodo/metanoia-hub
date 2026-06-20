import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlowProducer, Queue, Worker, type Processor } from 'bullmq';
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

  private readonly flowProducers: FlowProducer[] = [];

  /**
   * INF-02: FlowProducer — árvore invertida de jobs (children run before parent).
   * O parent job só executa após todos os children completarem.
   * Uso: refresh-platform-views (parent) depende de refresh-tenant-views (child).
   */
  createFlowProducer(): FlowProducer {
    const fp = new FlowProducer({
      connection: this.connection,
      prefix: QUEUE_PREFIX,
    });
    this.flowProducers.push(fp);
    return fp;
  }

  /**
   * Expõe connection options para uso em FlowJob direto.
   */
  getConnectionOptions(): typeof this.connection {
    return this.connection;
  }

  async onModuleDestroy() {
    await Promise.all([
      ...Array.from(this.queues.values()).map((q) => q.close()),
      ...this.workers.map((w) => w.close()),
      ...this.flowProducers.map((fp) => fp.close()),
    ]);
  }
}
