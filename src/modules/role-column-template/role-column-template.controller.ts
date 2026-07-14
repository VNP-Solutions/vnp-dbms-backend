import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateRoleColumnTemplateDto, UpdateRoleColumnTemplateDto } from './role-column-template.dto'
import type { IRoleColumnTemplateService } from './role-column-template.interface'

@ApiTags('Role Column Template')
@ApiBearerAuth('JWT-auth')
@Controller('role-column-template')
@UseGuards(JwtAuthGuard)
export class RoleColumnTemplateController {
  constructor(
    @Inject('IRoleColumnTemplateService')
    private readonly service: IRoleColumnTemplateService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role column template' })
  @ApiResponse({ status: 201, description: 'Role column template created successfully' })
  create(@Body() dto: CreateRoleColumnTemplateDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'Get all role column templates' })
  @ApiResponse({ status: 200, description: 'List of role column templates' })
  findAll() {
    return this.service.findAll()
  }

  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get role column templates by role ID' })
  @ApiResponse({ status: 200, description: 'Role column templates for the specified role' })
  findByRoleId(@Param('roleId') roleId: string) {
    return this.service.findByRoleId(roleId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get role column template by ID' })
  @ApiResponse({ status: 200, description: 'Role column template found' })
  @ApiResponse({ status: 404, description: 'Role column template not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update role column template by ID' })
  @ApiResponse({ status: 200, description: 'Role column template updated' })
  @ApiResponse({ status: 404, description: 'Role column template not found' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleColumnTemplateDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete role column template by ID' })
  @ApiResponse({ status: 200, description: 'Role column template deleted' })
  @ApiResponse({ status: 404, description: 'Role column template not found' })
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
