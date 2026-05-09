import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

vi.mock('@sentry/nestjs', () => ({
  withScope: vi.fn((cb: (scope: any) => void) => {
    const scope = { setTag: vi.fn(), setUser: vi.fn() };
    cb(scope);
    return scope;
  }),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nestjs';
import {
  AllExceptionsFilter,
  buildEnvelope,
} from '../http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockHost: ArgumentsHost;
  let mockResponse: any;
  let lastReply: { body: unknown; statusCode: number } | null;

  beforeEach(() => {
    vi.clearAllMocks();
    lastReply = null;

    mockResponse = {};

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => ({ url: '/test' }),
        getResponse: () => mockResponse,
        getNext: () => vi.fn(),
      }),
      getArgs: () => [],
      getArgByIndex: () => ({}),
      switchToRpc: () => ({}) as any,
      switchToWs: () => ({}) as any,
      getType: () => 'http' as any,
    } as unknown as ArgumentsHost;

    filter = new AllExceptionsFilter({
      reply: (_response: any, body: any, statusCode: number) => {
        lastReply = { body, statusCode };
      },
    } as any);
  });

  describe('buildEnvelope', () => {
    it('builds envelope from string-message HttpException', () => {
      const exc = new HttpException('Boom', HttpStatus.BAD_REQUEST);
      expect(buildEnvelope(exc, 400)).toEqual({
        statusCode: 400,
        error: 'BadRequest',
        message: 'Boom',
      });
    });

    it('preserves error and details from object-message HttpException', () => {
      const exc = new ForbiddenException({
        statusCode: 403,
        error: 'ConsentRequired',
        message: 'User must accept the current legal documents',
        details: { pending: ['terms'] },
      });

      expect(buildEnvelope(exc, 403)).toEqual({
        statusCode: 403,
        error: 'ConsentRequired',
        message: 'User must accept the current legal documents',
        details: { pending: ['terms'] },
      });
    });

    it('joins array messages with semicolons', () => {
      const exc = new HttpException(
        { message: ['field1 invalid', 'field2 invalid'] },
        400,
      );
      expect(buildEnvelope(exc, 400).message).toBe(
        'field1 invalid; field2 invalid',
      );
    });

    it('falls back to InternalServerError for unknown exceptions', () => {
      expect(buildEnvelope(new Error('boom'), 500)).toEqual({
        statusCode: 500,
        error: 'InternalServerError',
        message: 'An unexpected error occurred',
      });
    });

    it('maps known statuses to error names', () => {
      expect(buildEnvelope(new NotFoundException('x'), 404).error).toBe(
        'NotFound',
      );
    });

    it('omits details when not provided', () => {
      const env = buildEnvelope(new HttpException('hi', 400), 400);
      expect(env).not.toHaveProperty('details');
    });

    it('rejects unknown error names (whitelist guards FE error key map)', () => {
      const exc = new HttpException(
        { error: 'attacker-controlled-name', message: 'oops' },
        400,
      );
      expect(buildEnvelope(exc, 400).error).toBe('BadRequest');
    });

    it('accepts whitelisted domain error names', () => {
      const exc = new HttpException(
        { error: 'PlanLimitReached', message: 'too many groups' },
        403,
      );
      expect(buildEnvelope(exc, 403).error).toBe('PlanLimitReached');
    });
  });

  describe('catch', () => {
    it('writes standardized envelope through httpAdapter.reply', () => {
      const exc = new ForbiddenException('No access');
      filter.catch(exc, mockHost);

      expect(lastReply).toEqual({
        statusCode: 403,
        body: {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No access',
        },
      });
    });

    it('captures 5xx exceptions in Sentry', () => {
      filter.catch(new Error('boom'), mockHost);
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('does NOT call Sentry.captureException for 4xx', () => {
      filter.catch(new NotFoundException('not here'), mockHost);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('never includes stack traces in the response body', () => {
      filter.catch(new Error('Sensitive stack'), mockHost);
      const body = lastReply?.body as Record<string, unknown>;
      expect(body).not.toHaveProperty('stack');
      expect(JSON.stringify(body)).not.toMatch(/at\s+\w+/);
    });

    it('preserves errorKey via details for frontend mapping', () => {
      const exc = new HttpException(
        {
          statusCode: 403,
          error: 'Forbidden',
          message: 'Limite atingido',
          details: { errorKey: 'plan.limit_reached', current: 3, max: 3 },
        },
        HttpStatus.FORBIDDEN,
      );
      filter.catch(exc, mockHost);

      const body = lastReply?.body as any;
      expect(body.details.errorKey).toBe('plan.limit_reached');
      expect(body.details.current).toBe(3);
    });
  });
});
