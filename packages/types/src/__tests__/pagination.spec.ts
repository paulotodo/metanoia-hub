import { describe, it, expect } from 'vitest';
import { PaginationSchema } from '../pagination';

describe('PaginationSchema', () => {
  it('should parse valid pagination params', () => {
    const result = PaginationSchema.parse({ page: 1, pageSize: 20 });
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it('should apply defaults when omitted', () => {
    const result = PaginationSchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it('should reject page < 1', () => {
    expect(() => PaginationSchema.parse({ page: 0 })).toThrow();
  });

  it('should reject pageSize > 100', () => {
    expect(() => PaginationSchema.parse({ pageSize: 101 })).toThrow();
  });

  it('should match snapshot', () => {
    expect(PaginationSchema.shape).toMatchSnapshot();
  });
});
