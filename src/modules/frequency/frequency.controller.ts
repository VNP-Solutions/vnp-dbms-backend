import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateFrequencyDto, DeleteFrequencyDto, ReorderFrequencyDto, UpdateFrequencyDto } from './frequency.dto'
import type { IFrequencyService } from './frequency.interface'

@ApiTags('Frequency')
@ApiBearerAuth('JWT-auth')
@Controller('frequency')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FrequencyController {
  constructor(
    @Inject('IFrequencyService')
    private readonly frequencyService: IFrequencyService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new frequency' })
  @ApiResponse({ status: 201, description: 'Frequency created successfully' })
  create(@Body() dto: CreateFrequencyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.create(dto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all frequencies (public)' })
  @ApiResponse({ status: 200, description: 'List of frequencies' })
  findAll() {
    return this.frequencyService.findAll(null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get frequency by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a frequency' })
  update(@Param('id') id: string, @Body() dto: UpdateFrequencyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.update(id, dto, user)
  }

  @Patch(':id/toggle')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Toggle active/inactive for a frequency' })
  toggle(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.toggle(id, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a frequency' })
  reorder(@Param('id') id: string, @Body() dto: ReorderFrequencyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.reorder(id, dto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a frequency (requires password)' })
  remove(@Param('id') id: string, @Body() dto: DeleteFrequencyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.frequencyService.remove(id, dto.password, user)
  }
}
