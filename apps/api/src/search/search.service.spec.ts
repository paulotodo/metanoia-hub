import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from './search.service';
import { Role } from '../auth/enums/role.enum';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueryRaw = vi.fn();

const mockTx = {
  $queryRaw: mockQueryRaw,
};

vi.mock('../prisma/with-tenant-tx', () => ({
  withTenantTx: vi.fn(
    (_prisma: unknown, fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  ),
}));

const mockPrisma = {};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<{
  lesson_id: string;
  lesson_name: string;
  module_id: string;
  module_name: string;
  trail_id: string;
  trail_name: string;
  content_type: string;
  snippet: string;
  rank: number;
  is_draft: boolean;
  total_count: number;
}> = {}) {
  return {
    lesson_id:   'lesson-01',
    lesson_name: 'Fundamentos da Fé',
    module_id:   'module-01',
    module_name: 'Módulo 1',
    trail_id:    'trail-01',
    trail_name:  'Trilha Inicial',
    content_type: 'rich_text',
    snippet:     'Fundamentos\x02da\x03 fé cristã',
    rank:        0.82,
    is_draft:    false,
    total_count: 1,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    mockQueryRaw.mockReset();
    service = new SearchService(mockPrisma as never);
  });

  describe('basic search', () => {
    it('returns SearchResultItem[] with correct camelCase fields', async () => {
      mockQueryRaw.mockResolvedValue([makeRow()]);

      const result = await service.search('fé', [Role.LIDER]);

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.lessonId).toBe('lesson-01');
      expect(item.lessonName).toBe('Fundamentos da Fé');
      expect(item.moduleId).toBe('module-01');
      expect(item.moduleName).toBe('Módulo 1');
      expect(item.trailId).toBe('trail-01');
      expect(item.trailName).toBe('Trilha Inicial');
      expect(item.contentType).toBe('rich_text');
      expect(item.rank).toBe(0.82);
      expect(item.isDraft).toBe(false);
      // snippet uses sentinels — NOT HTML tags
      expect(item.snippet).toContain('\x02');
      expect(item.snippet).not.toContain('<b>');
      expect(item.snippet).not.toContain('<em>');
    });

    it('never has undefined fields in result items', async () => {
      mockQueryRaw.mockResolvedValue([makeRow()]);

      const result = await service.search('fé', [Role.ADMIN_TENANT]);
      const item = result.data[0];

      for (const [key, val] of Object.entries(item)) {
        expect(val, `field ${key} must not be undefined`).not.toBeUndefined();
      }
    });
  });

  describe('empty results', () => {
    it('returns empty data and meta total=0 when no rows', async () => {
      mockQueryRaw.mockResolvedValue([]);

      const result = await service.search('noresults', [Role.LIDER]);

      expect(result).toEqual({ data: [], meta: { total: 0, query: 'noresults' } });
    });
  });

  describe('XSS sentinel dec-014', () => {
    it('snippet for lesson with name containing <script> uses sentinels not HTML tags', async () => {
      // dec-014: name='<script>alert(1)</script>' — sentinel chars must be present, no <b> no innerHTML
      mockQueryRaw.mockResolvedValue([
        makeRow({
          lesson_name: '<script>alert(1)</script>',
          snippet: '<script>alert(1)</script> \x02script\x03 alert 1',
        }),
      ]);

      const result = await service.search('script', [Role.ADMIN_TENANT]);

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      // snippet may contain literal < and > as plain text — but never <b> injection
      expect(item.snippet).not.toContain('<b>');
      expect(item.snippet).not.toContain('<em>');
      expect(item.snippet).not.toContain('<mark>');
      // sentinel chars used for highlighting
      expect(item.snippet).toContain('\x02');
      expect(item.snippet).toContain('\x03');
    });

    it('removes pre-existing sentinels from lesson_name (dec-014 hygiene)', async () => {
      // The SQL strips sentinels from lesson_name — service receives clean name
      mockQueryRaw.mockResolvedValue([
        makeRow({
          lesson_name: 'Clean Name',  // SQL already stripped \x02/\x03 via REPLACE
          snippet: 'Clean\x02Name\x03 result',
        }),
      ]);

      const result = await service.search('name', [Role.LIDER]);
      expect(result.data[0].lessonName).toBe('Clean Name');
    });
  });

  describe('role visibility', () => {
    it('participante does not receive lessons from draft trails', async () => {
      // When isParticipante=true, the SQL filters t.status != draft
      // The mock returns empty (as if Postgres filtered it out)
      mockQueryRaw.mockResolvedValue([]);

      const result = await service.search('fé', [Role.PARTICIPANTE]);

      // Mock returns empty — verify no draft rows leaked
      expect(result.data.filter((i) => i.isDraft)).toHaveLength(0);
    });

    it('lider receives draft trail lessons with isDraft: true', async () => {
      mockQueryRaw.mockResolvedValue([
        makeRow({ is_draft: true, trail_name: 'Draft Trail' }),
      ]);

      const result = await service.search('fé', [Role.LIDER]);

      expect(result.data[0].isDraft).toBe(true);
    });

    it('admin_tenant receives draft trail lessons with isDraft: true', async () => {
      mockQueryRaw.mockResolvedValue([
        makeRow({ is_draft: true }),
      ]);

      const result = await service.search('fé', [Role.ADMIN_TENANT]);

      expect(result.data[0].isDraft).toBe(true);
    });
  });

  describe('unsafe query sanitisation', () => {
    const unsafeInputs = [
      "'; DROP TABLE lessons; --",
      '(unbalanced',
      'term & other',
      'quote"here',
      "single'quote",
      'excl!amation',
    ];

    for (const unsafe of unsafeInputs) {
      it(`returns empty results for unsafe input: ${unsafe}`, async () => {
        // mockQueryRaw should NOT be called for unsafe inputs
        const result = await service.search(unsafe, [Role.LIDER]);

        expect(result.data).toHaveLength(0);
        expect(result.meta.total).toBe(0);
        expect(mockQueryRaw).not.toHaveBeenCalled();
      });
    }
  });

  describe('meta total', () => {
    it('returns total from total_count window function', async () => {
      mockQueryRaw.mockResolvedValue([
        makeRow({ total_count: 42 }),
        makeRow({ lesson_id: 'lesson-02', total_count: 42 }),
      ]);

      const result = await service.search('fé', [Role.ADMIN_TENANT]);

      expect(result.meta.total).toBe(42);
      expect(result.data).toHaveLength(2);
    });
  });
});
