import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  BulkUpdatePropertyCredentialsDto,
  CreatePropertyCredentialsDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'
import type { IPropertyCredentialsService } from './property-credentials.interface'

@ApiTags('Property Credentials')
@ApiBearerAuth('JWT-auth')
@Controller('property-credentials')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyCredentialsController {
  constructor(
    @Inject('IPropertyCredentialsService')
    private readonly credentialsService: IPropertyCredentialsService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create new property credentials' })
  @ApiResponse({ status: 201, description: 'Property credentials created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreatePropertyCredentialsDto) {
    return this.credentialsService.create(dto)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all property credentials' })
  @ApiResponse({ status: 200, description: 'Returns list of property credentials' })
  findAll(@ParseQuery() _query: Record<string, any>) {
    return this.credentialsService.findAll()
  }

  @Get('property/:propertyId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({ summary: 'Get property credentials by property ID' })
  @ApiResponse({ status: 200, description: 'Returns property credentials' })
  @ApiResponse({ status: 404, description: 'Property credentials not found' })
  findByPropertyId(@Param('propertyId') propertyId: string) {
    return this.credentialsService.findByPropertyId(propertyId)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({ summary: 'Get property credentials by ID' })
  @ApiResponse({ status: 200, description: 'Returns property credentials' })
  @ApiResponse({ status: 404, description: 'Property credentials not found' })
  findOne(@Param('id') id: string) {
    return this.credentialsService.findOne(id)
  }

  @Put('bulk-update')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Apply the same credentials to multiple properties' })
  @ApiResponse({
    status: 200,
    description: 'Credentials applied to properties successfully'
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  bulkUpdate(@Body() dto: BulkUpdatePropertyCredentialsDto) {
    return this.credentialsService.bulkUpdate(dto)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update property credentials by ID' })
  @ApiResponse({ status: 200, description: 'Property credentials updated successfully' })
  @ApiResponse({ status: 404, description: 'Property credentials not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(@Param('id') id: string, @Body() dto: UpdatePropertyCredentialsDto) {
    return this.credentialsService.update(id, dto)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete property credentials by ID' })
  @ApiResponse({ status: 200, description: 'Property credentials deleted successfully' })
  @ApiResponse({ status: 404, description: 'Property credentials not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@Param('id') id: string) {
    return this.credentialsService.remove(id)
  }
}
