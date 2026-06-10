import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../auth/keycloak.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { PublishingService } from './publishing.service';

@Controller('api/v1/trails')
@UseGuards(KeycloakAuthGuard, RolesGuard)
export class PublishingController {
  constructor(private readonly service: PublishingService) {}

  /**
   * POST /api/v1/trails/:trailId/publish
   * Publish a draft trail (or re-publish with incremented version).
   * Only ADMIN_TENANT can publish.
   */
  @Post(':trailId/publish')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN_TENANT)
  async publishTrail(@Param('trailId', ParseUUIDPipe) trailId: string) {
    const { trail, event } = await this.service.publishTrail(trailId);
    return { data: trail, meta: { event } };
  }
}
