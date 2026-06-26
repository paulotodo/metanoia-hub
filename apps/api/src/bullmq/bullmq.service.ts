import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FlowProducer, Queue, Worker, type Processor } from 'bullmq';
import type { Job } from 'bullmq';
import { injectTraceContext, runWithExtractedContext } from './bullmq-tracing';
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
    // Wrap processor to extract trace context from job data (FR-12 / OWASP M3/M4)
    const tracedProcessor: Processor = (job: Job) =>
      runWithExtractedContext(
        job.data,
        {
          queueName: name,
          jobName: job.name,
          jobId: job.id ?? '',
          attemptsMade: job.attemptsMade,
        },
        () => processor(job) as Promise<unknown>,
      );

    const worker = new Worker(name, tracedProcessor, {
      connection: this.connection,
      prefix: QUEUE_PREFIX,
    });
    this.workers.push(worker);
    return worker;
  }

  /**
   * Enqueue a job with trace context injected (FR-12 producer side).
   * Use this instead of queue.add() to propagate W3C traceparent across async boundary.
   */
  async addJob<T extends object>(
    queue: Queue,
    name: string,
    data: T,
    opts?: Parameters<Queue['add']>[2],
  ): Promise<ReturnType<Queue['add']>> {
    const tracedData = injectTraceContext(data);
    return queue.add(name, tracedData, opts);
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
