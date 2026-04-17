import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  SelectTenantInputSchema,
  type SelectTenantInput,
} from '@metanoia/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TenantSelectionService } from './tenant-selection.service';

@Controller('api/v1/auth')
export class TenantSelectionController {
  constructor(private readonly service: TenantSelectionService) {}

  @Get('my-tenants')
  async myTenants() {
    const data = await this.service.listMyTenants();
    return { data };
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  async selectTenant(
    @Body(new ZodValidationPipe(SelectTenantInputSchema))
    body: SelectTenantInput,
  ) {
    const data = await this.service.selectTenant(body.tenantId);
    return { data };
  }
}
