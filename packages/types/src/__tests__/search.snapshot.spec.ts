import { describe, it, expect } from 'vitest';
import {
  searchResultItemSchema,
  searchResponseSchema,
  searchQuerySchema,
} from '../search/search-result.schema';

const VALID_ITEM = {
  lessonId: '019078ab-0000-7000-8000-000000000001',
  lessonName: 'Fundamentos da Fé',
  moduleId: '019078ab-0000-7000-8000-000000000002',
  moduleName: 'Módulo 1',
  trailId: '019078ab-0000-7000-8000-000000000003',
  trailName: 'Trilha Inicial',
  contentType: 'rich_text' as const,
  snippet: 'Fé\x02fundamentos\x03 da vida cristã',
  rank: 0.82,
  isDraft: false,
};

describe('searchResultItemSchema snapshot', () => {
  it('accepts valid item', () => {
    const result = searchResultItemSchema.safeParse(VALID_ITEM);
    expect(result.success).toBe(true);
  });

  it('freezes valid item shape', () => {
    const result = searchResultItemSchema.safeParse(VALID_ITEM);
    expect({ success: result.success, data: result.success ? result.data : null }).toMatchInlineSnapshot(`
      {
        "data": {
          "contentType": "rich_text",
          "isDraft": false,
          "lessonId": "019078ab-0000-7000-8000-000000000001",
          "lessonName": "Fundamentos da Fé",
          "moduleId": "019078ab-0000-7000-8000-000000000002",
          "moduleName": "Módulo 1",
          "rank": 0.82,
          "snippet": "Fé\x02fundamentos\x03 da vida cristã",
          "trailId": "019078ab-0000-7000-8000-000000000003",
          "trailName": "Trilha Inicial",
        },
        "success": true,
      }
    `);
  });

  it('rejects invalid contentType', () => {
    const result = searchResultItemSchema.safeParse({ ...VALID_ITEM, contentType: 'html' });
    expect(result.success).toBe(false);
  });

  it('accepts isDraft: true for leader visibility', () => {
    const result = searchResultItemSchema.safeParse({ ...VALID_ITEM, isDraft: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isDraft).toBe(true);
  });
});

describe('searchResponseSchema snapshot', () => {
  it('accepts valid response envelope', () => {
    const result = searchResponseSchema.safeParse({
      data: [VALID_ITEM],
      meta: { total: 1, query: 'fé' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty data (no results)', () => {
    const result = searchResponseSchema.safeParse({
      data: [],
      meta: { total: 0, query: 'xyz' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toHaveLength(0);
      expect(result.data.meta.total).toBe(0);
    }
  });

  it('rejects data longer than 20 items', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      ...VALID_ITEM,
      lessonId: `019078ab-0000-7000-8000-0000000000${String(i + 1).padStart(2, '0')}`,
    }));
    const result = searchResponseSchema.safeParse({ data: items, meta: { total: 21, query: 'x' } });
    expect(result.success).toBe(false);
  });
});

describe('searchQuerySchema', () => {
  it('accepts valid q param', () => {
    const result = searchQuerySchema.safeParse({ q: 'fé e graça' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe('fé e graça');
  });

  it('trims whitespace from q', () => {
    const result = searchQuerySchema.safeParse({ q: '  oração  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe('oração');
  });

  it('rejects empty q', () => {
    const result = searchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing q', () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
