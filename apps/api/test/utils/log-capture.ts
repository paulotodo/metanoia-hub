import { Writable } from 'node:stream';
import { LoggerModule } from 'nestjs-pino';
import { requestContext } from '../../src/common/context/request-context';

export interface CapturedLog {
  level: number;
  msg: string;
  [key: string]: unknown;
}

export class LogCapture {
  public readonly logs: CapturedLog[] = [];
  public readonly stream: Writable;

  constructor() {
    this.stream = new Writable({
      write: (chunk, _encoding, callback) => {
        try {
          this.logs.push(JSON.parse(chunk.toString()));
        } catch {
          // ignore non-JSON lines
        }
        callback();
      },
    });
  }

  find(predicate: (log: CapturedLog) => boolean): CapturedLog[] {
    return this.logs.filter(predicate);
  }

  byTenant(tenantId: string): CapturedLog[] {
    return this.find((l) => l.tenantId === tenantId);
  }

  expectLog(fields: Partial<CapturedLog>): void {
    const match = this.logs.some((log) =>
      Object.entries(fields).every(([k, v]) => log[k] === v),
    );
    if (!match) {
      throw new Error(
        `No log matching ${JSON.stringify(fields)}.\nCaptured logs: ${JSON.stringify(this.logs, null, 2)}`,
      );
    }
  }

  clear(): void {
    this.logs.length = 0;
  }
}

export function createTestLoggerModule(capture: LogCapture) {
  return LoggerModule.forRoot({
    pinoHttp: {
      stream: capture.stream,
      level: 'trace',
      customProps: () => {
        const store = requestContext.getStore();
        return {
          requestId: store?.requestId,
          correlationId: store?.correlationId,
          tenantId: store?.tenantId || null,
          userId: store?.userId || null,
        };
      },
    },
  });
}
