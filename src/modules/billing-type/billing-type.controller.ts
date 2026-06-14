import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateBillingTypeDto, DeleteBillingTypeDto, ReorderBillingTypeDto, UpdateBillingTypeDto } from './billing-type.dto'
import type { IBillingTypeService } from './billing-type.interface'

@ApiTags('Billing Type')
@ApiBearerAuth('JWT-auth')
@Controller('billing-type')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingTypeController {
  constructor(
    @Inject('IBillingTypeService')
    private readonly billingTypeService: IBillingTypeService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new billing type' })
  @ApiResponse({ status: 201, description: 'Billing type created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreateBillingTypeDto, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.create(dto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all billing types (public)' })
  @ApiResponse({ status: 200, description: 'List of billing types' })
  findAll() {
    return this.billingTypeService.findAll(null as any)
  }

  @Get('except/:id')
  @Public()
  @ApiOperation({ summary: 'Get all billing types except the specified one (public)' })
  @ApiResponse({ status: 200, description: 'List of billing types excluding the specified ID' })
  @ApiResponse({ status: 404, description: 'Billing type not found' })
  findAllExcept(@Param('id') id: string) {
    return this.billingTypeService.findAllExcept(id, null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get billing type by ID' })
  @ApiResponse({ status: 200, description: 'Billing type found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a billing type' })
  @ApiResponse({ status: 200, description: 'Billing type updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id') id: string, @Body() dto: UpdateBillingTypeDto, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.update(id, dto, user)
  }

  @Patch(':id/toggle')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Toggle active/inactive for a billing type' })
  @ApiResponse({ status: 200, description: 'Billing type toggled' })
  @ApiResponse({ status: 404, description: 'Not found' })
  toggle(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.toggle(id, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a billing type' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  reorder(@Param('id') id: string, @Body() dto: ReorderBillingTypeDto, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.reorder(id, dto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a billing type (requires password)' })
  @ApiResponse({ status: 200, description: 'Billing type deleted' })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  remove(@Param('id') id: string, @Body() dto: DeleteBillingTypeDto, @CurrentUser() user: IUserWithPermissions) {
    return this.billingTypeService.remove(id, dto.password, dto.replacementId, user)
  }
}
