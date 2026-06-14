import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    UseGuards
} from '@nestjs/common'
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
    ModuleType,
    PermissionAction
} from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
    CreateServiceTypeDto,
    DeleteServiceTypeDto,
    ReorderServiceTypeDto,
    UpdateServiceTypeDto
} from './service-type.dto'
import type { IServiceTypeService } from './service-type.interface'

@ApiTags('Service Type')
@ApiBearerAuth('JWT-auth')
@Controller('service-type')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ServiceTypeController {
  constructor(
    @Inject('IServiceTypeService')
    private readonly serviceTypeService: IServiceTypeService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new service type' })
  @ApiResponse({
    status: 201,
    description: 'Service type created successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createServiceTypeDto: CreateServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.create(createServiceTypeDto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all service types (public)' })
  @ApiResponse({
    status: 200,
    description: 'List of service types retrieved successfully'
  })
  findAll() {
    return this.serviceTypeService.findAll(null as any)
  }

  @Get('except/:id')
  @Public()
  @ApiOperation({ summary: 'Get all service types except the specified one (public)' })
  @ApiResponse({
    status: 200,
    description: 'List of service types excluding the specified ID'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  findAllExcept(@Param('id') id: string) {
    return this.serviceTypeService.findAllExcept(id, null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get a service type by ID' })
  @ApiResponse({
    status: 200,
    description: 'Service type retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.serviceTypeService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a service type' })
  @ApiResponse({
    status: 200,
    description: 'Service type updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateServiceTypeDto: UpdateServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.update(id, updateServiceTypeDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Delete a service type (requires password verification)'
  })
  @ApiResponse({
    status: 200,
    description: 'Service type deleted successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete service type with associated portfolios or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deleteServiceTypeDto: DeleteServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.remove(
      id,
      deleteServiceTypeDto.password,
      deleteServiceTypeDto.replacementId,
      user
    )
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a service type' })
  @ApiResponse({
    status: 200,
    description: 'Service type order updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Service type not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  reorder(
    @Param('id') id: string,
    @Body() reorderServiceTypeDto: ReorderServiceTypeDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.serviceTypeService.reorder(id, reorderServiceTypeDto, user)
  }
}
