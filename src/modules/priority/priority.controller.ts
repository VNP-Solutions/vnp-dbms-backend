import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreatePriorityDto, DeletePriorityDto, ReorderPriorityDto, UpdatePriorityDto } from './priority.dto'
import type { IPriorityService } from './priority.interface'

@ApiTags('Priority')
@ApiBearerAuth('JWT-auth')
@Controller('priority')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PriorityController {
  constructor(
    @Inject('IPriorityService')
    private readonly priorityService: IPriorityService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new priority' })
  @ApiResponse({ status: 201, description: 'Priority created successfully' })
  create(@Body() dto: CreatePriorityDto, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.create(dto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all priorities (public)' })
  @ApiResponse({ status: 200, description: 'List of priorities' })
  findAll() {
    return this.priorityService.findAll(null as any)
  }

  @Get('except/:id')
  @Public()
  @ApiOperation({ summary: 'Get all priorities except the specified one (public)' })
  @ApiResponse({ status: 200, description: 'List of priorities excluding the specified ID' })
  @ApiResponse({ status: 404, description: 'Priority not found' })
  findAllExcept(@Param('id') id: string) {
    return this.priorityService.findAllExcept(id, null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get priority by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a priority' })
  update(@Param('id') id: string, @Body() dto: UpdatePriorityDto, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.update(id, dto, user)
  }

  @Patch(':id/toggle')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Toggle active/inactive for a priority' })
  toggle(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.toggle(id, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a priority' })
  reorder(@Param('id') id: string, @Body() dto: ReorderPriorityDto, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.reorder(id, dto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a priority (requires password)' })
  remove(@Param('id') id: string, @Body() dto: DeletePriorityDto, @CurrentUser() user: IUserWithPermissions) {
    return this.priorityService.remove(id, dto.password, dto.replacementId, user)
  }
}
