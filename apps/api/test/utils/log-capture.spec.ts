import { describe, it, expect, beforeEach } from 'vitest';
import { LogCapture } from './log-capture';

describe('LogCapture', () => {
  let capture: LogCapture;

  beforeEach(() => {
    capture = new LogCapture();
  });

  it('should capture JSON log lines', () => {
    const logLine = JSON.stringify({
      level: 30,
      msg: 'test message',
      tenantId: 'tenant-1',
    });

    capture.stream.write(logLine);

    expect(capture.logs).toHaveLength(1);
    expect(capture.logs[0].msg).toBe('test message');
    expect(capture.logs[0].tenantId).toBe('tenant-1');
  });

  it('should ignore non-JSON lines', () => {
    capture.stream.write('not valid json');
    expect(capture.logs).toHaveLength(0);
  });

  it('should filter by tenant via byTenant()', () => {
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'a', tenantId: 'tenant-A' }),
    );
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'b', tenantId: 'tenant-B' }),
    );
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'c', tenantId: 'tenant-A' }),
    );

    const results = capture.byTenant('tenant-A');
    expect(results).toHaveLength(2);
    expect(results.every((l) => l.tenantId === 'tenant-A')).toBe(true);
  });

  it('should pass expectLog when matching fields exist', () => {
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'hello', action: 'create' }),
    );

    expect(() => capture.expectLog({ msg: 'hello', action: 'create' })).not.toThrow();
  });

  it('should throw expectLog when no matching fields', () => {
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'hello' }),
    );

    expect(() => capture.expectLog({ msg: 'goodbye' })).toThrow(
      'No log matching',
    );
  });

  it('should clear all logs', () => {
    capture.stream.write(JSON.stringify({ level: 30, msg: 'a' }));
    capture.stream.write(JSON.stringify({ level: 30, msg: 'b' }));
    expect(capture.logs).toHaveLength(2);

    capture.clear();
    expect(capture.logs).toHaveLength(0);
  });

  it('should find logs with custom predicate', () => {
    capture.stream.write(
      JSON.stringify({ level: 30, msg: 'info', code: 200 }),
    );
    capture.stream.write(
      JSON.stringify({ level: 50, msg: 'error', code: 500 }),
    );

    const errors = capture.find((l) => l.level === 50);
    expect(errors).toHaveLength(1);
    expect(errors[0].msg).toBe('error');
  });
});
