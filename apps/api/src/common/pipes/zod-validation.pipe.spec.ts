import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().min(0),
  });

  const pipe = new ZodValidationPipe(schema);

  it('should return parsed data for valid input', () => {
    const input = { email: 'user@example.com', age: 25 };
    expect(pipe.transform(input)).toEqual(input);
  });

  it('should throw BadRequestException for invalid input', () => {
    const input = { email: 'not-email', age: -1 };
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it('should include field errors in exception details', () => {
    try {
      pipe.transform({ email: 'bad', age: 'not-number' });
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(400);
      expect(response.error).toBe('Bad Request');
      expect(response.message).toBe('Validation failed');
      expect(response.details).toBeDefined();
    }
  });

  it('should strip unknown fields', () => {
    const input = { email: 'user@example.com', age: 25, extra: 'field' };
    const result = pipe.transform(input);
    expect(result).toEqual({ email: 'user@example.com', age: 25 });
  });
});
