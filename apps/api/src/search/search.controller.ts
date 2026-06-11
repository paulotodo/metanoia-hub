import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { KeycloakAuthGuard } from '../auth/keycloak.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { searchQuerySchema, type SearchQuery } from '@metanoia/types';
import { SearchService } from './search.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('search')
@Controller('api/v1/search')
@UseGuards(KeycloakAuthGuard, TenantGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/v1/search?q=<term>
   *
   * Full-text search over lessons within the authenticated tenant.
   * Returns up to 20 results sorted by relevance (ts_rank DESC).
   * Always returns 200 — empty data array when no matches (FR-010).
   *
   * TODO(CHK021): throttle específico pós-MVP — risco aceitável para MVP com
   * escala atual. Adicionar @Throttle({ default: { limit: 30, ttl: 60000 } })
   * quando ThrottlerModule for wired no AppModule.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Full-text search over lessons within the current tenant' })
  @ApiQuery({ name: 'q', description: 'Search term (min 1 char)', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Search results — empty array when no matches',
  })
  async search(
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
    @Request() req: { user: AuthenticatedUser },
  ) {
    return this.searchService.search(query.q, req.user.roles);
  }
}
