import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateProcessorDto, DeleteProcessorDto, ReorderProcessorDto, UpdateProcessorDto } from './processor.dto'
import type { IProcessorService } from './processor.interface'

@ApiTags('Processor')
@ApiBearerAuth('JWT-auth')
@Controller('processor')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProcessorController {
  constructor(
    @Inject('IProcessorService')
    private readonly processorService: IProcessorService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new processor' })
  @ApiResponse({ status: 201, description: 'Processor created successfully' })
  create(@Body() dto: CreateProcessorDto, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.create(dto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all processors (public)' })
  @ApiResponse({ status: 200, description: 'List of processors' })
  findAll() {
    return this.processorService.findAll(null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get processor by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a processor' })
  update(@Param('id') id: string, @Body() dto: UpdateProcessorDto, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.update(id, dto, user)
  }

  @Patch(':id/toggle')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Toggle active/inactive for a processor' })
  toggle(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.toggle(id, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a processor' })
  reorder(@Param('id') id: string, @Body() dto: ReorderProcessorDto, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.reorder(id, dto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a processor (requires password)' })
  remove(@Param('id') id: string, @Body() dto: DeleteProcessorDto, @CurrentUser() user: IUserWithPermissions) {
    return this.processorService.remove(id, dto.password, user)
  }
}
