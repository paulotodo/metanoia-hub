import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTenantTx } from '../prisma/with-tenant-tx';
import { Role } from '../auth/enums/role.enum';
import type { SearchResultItem, SearchResponse } from '@metanoia/types';

/**
 * Raw row returned by the $queryRaw search query.
 * snake_case from PostgreSQL — mapped to camelCase in service.
 */
interface SearchRow {
  lesson_id: string;
  lesson_name: string;
  module_id: string;
  module_name: string;
  trail_id: string;
  trail_name: string;
  content_type: string;
  snippet: string;
  rank: number | string;
  is_draft: boolean;
  total_count: string | number;
}

/**
 * Characters that cause `to_tsquery` to error.
 * Strategy: if any unsafe character detected, return empty results.
 */
const TSQUERY_UNSAFE_RE = /[()&|!*:'"\\]/;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text search over lessons visible to the tenant.
   *
   * @param q      - The raw search term from the request query string.
   * @param roles  - Roles of the authenticated user (from JWT).
   * @returns      SearchResponse with data (max 20) and meta.
   */
  async search(q: string, roles: (Role | string)[]): Promise<SearchResponse> {
    const trimmed = q.trim();
    const startMs = Date.now();

    // Sanitise: if term contains tsquery-unsafe chars, return empty safely (no 500).
    if (TSQUERY_UNSAFE_RE.test(trimmed)) {
      this.logger.debug('search: unsafe tsquery chars — returning empty', { q });
      return { data: [], meta: { total: 0, query: trimmed } };
    }

    // Normalise for tsquery: prefix-match each word with :*
    const tsQueryTerm = trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word + ':*')
      .join(' & ');

    const isParticipante =
      !roles.includes(Role.ADMIN_TENANT) &&
      !roles.includes(Role.LIDER) &&
      !roles.includes(Role.SUPER_ADMIN);

    const rows = await withTenantTx(this.prisma, async (tx) => {
      if (isParticipante) {
        // Participants: exclude draft trails
        return tx.$queryRaw<SearchRow[]>(
          Prisma.sql`
            SELECT
              l.id                                                              AS lesson_id,
              REPLACE(REPLACE(l.name, E'\x02', ''), E'\x03', '')               AS lesson_name,
              m.id                                                              AS module_id,
              m.name                                                            AS module_name,
              t.id                                                              AS trail_id,
              t.name                                                            AS trail_name,
              l.content_type                                                    AS content_type,
              ts_headline(
                'pg_catalog.portuguese',
                REPLACE(REPLACE(
                  unaccent(l.name || ' ' || array_to_string(l.tags, ' ')),
                  E'\x02', ''
                ), E'\x03', ''),
                to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm})),
                'StartSel=\x02, StopSel=\x03, MaxWords=20, MinWords=10'
              )                                                                 AS snippet,
              ts_rank(l.search_vector,
                to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm}))
              )::float                                                          AS rank,
              false                                                             AS is_draft,
              COUNT(*) OVER ()                                                  AS total_count
            FROM lessons l
            JOIN modules m ON m.id = l.module_id AND m.deleted_at IS NULL
            JOIN trails  t ON t.id = m.trail_id  AND t.deleted_at IS NULL
            WHERE
              l.deleted_at IS NULL
              AND t.status != 'draft'
              AND l.search_vector @@ to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm}))
            ORDER BY rank DESC
            LIMIT 20
          `,
        );
      } else {
        // Leader/Admin/SuperAdmin: include drafts with is_draft flag
        return tx.$queryRaw<SearchRow[]>(
          Prisma.sql`
            SELECT
              l.id                                                              AS lesson_id,
              REPLACE(REPLACE(l.name, E'\x02', ''), E'\x03', '')               AS lesson_name,
              m.id                                                              AS module_id,
              m.name                                                            AS module_name,
              t.id                                                              AS trail_id,
              t.name                                                            AS trail_name,
              l.content_type                                                    AS content_type,
              ts_headline(
                'pg_catalog.portuguese',
                REPLACE(REPLACE(
                  unaccent(l.name || ' ' || array_to_string(l.tags, ' ')),
                  E'\x02', ''
                ), E'\x03', ''),
                to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm})),
                'StartSel=\x02, StopSel=\x03, MaxWords=20, MinWords=10'
              )                                                                 AS snippet,
              ts_rank(l.search_vector,
                to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm}))
              )::float                                                          AS rank,
              (t.status = 'draft')                                              AS is_draft,
              COUNT(*) OVER ()                                                  AS total_count
            FROM lessons l
            JOIN modules m ON m.id = l.module_id AND m.deleted_at IS NULL
            JOIN trails  t ON t.id = m.trail_id  AND t.deleted_at IS NULL
            WHERE
              l.deleted_at IS NULL
              AND l.search_vector @@ to_tsquery('pg_catalog.portuguese', unaccent(${tsQueryTerm}))
            ORDER BY rank DESC
            LIMIT 20
          `,
        );
      }
    });

    const data: SearchResultItem[] = rows.map((row) => ({
      lessonId:    row.lesson_id,
      lessonName:  row.lesson_name,
      moduleId:    row.module_id,
      moduleName:  row.module_name,
      trailId:     row.trail_id,
      trailName:   row.trail_name,
      contentType: row.content_type as SearchResultItem['contentType'],
      snippet:     row.snippet ?? '',
      rank:        typeof row.rank === 'number' ? row.rank : parseFloat(String(row.rank)) || 0,
      isDraft:     Boolean(row.is_draft),
    }));

    const total = rows.length > 0
      ? parseInt(String(rows[0].total_count), 10)
      : 0;

    const durationMs = Date.now() - startMs;

    // Structured log — q is NOT logged to avoid PII pastoral (CHK058)
    this.logger.log({
      event: 'search.executed',
      resultCount: data.length,
      hasResults: data.length > 0,
      durationMs,
      // TODO(CHK058): expor durationMs via Prometheus/Datadog quando observabilidade for implementada
    });

    return { data, meta: { total, query: trimmed } };
  }
}
