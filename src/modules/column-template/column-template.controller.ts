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
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'
import type { IColumnTemplateService } from './column-template.interface'

@ApiTags('Column Template')
@ApiBearerAuth('JWT-auth')
@Controller('column-template')
@UseGuards(JwtAuthGuard)
export class ColumnTemplateController {
  constructor(
    @Inject('IColumnTemplateService')
    private readonly service: IColumnTemplateService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new column template' })
  @ApiResponse({ status: 201, description: 'Column template created successfully' })
  create(@Body() dto: CreateColumnTemplateDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'Get all column templates' })
  @ApiResponse({ status: 200, description: 'List of column templates' })
  findAll() {
    return this.service.findAll()
  }

  @Get('auth')
  @ApiOperation({
    summary: 'Get column templates for the authenticated user',
    description:
      'Returns main_column (column_list of the column template assigned to the user\'s role) and all_columns (all column templates belonging to the user).'
  })
  @ApiResponse({
    status: 200,
    description: 'Auth column template result',
    schema: {
      properties: {
        main_column: { type: 'array', items: { type: 'string' } },
        all_columns: { type: 'array' }
      }
    }
  })
  findByAuth(@CurrentUser() user: IUserWithPermissions) {
    return this.service.findByAuth(user)
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get column templates by user ID' })
  @ApiResponse({ status: 200, description: 'Column templates for the specified user' })
  findByUserId(@Param('userId') userId: string) {
    return this.service.findByUserId(userId)
  }

  @Get('role/:roleId')
  @ApiOperation({ summary: 'Get column templates assigned to a role ID' })
  @ApiResponse({ status: 200, description: 'Column templates assigned to the specified role' })
  findByRoleId(@Param('roleId') roleId: string) {
    return this.service.findByRoleId(roleId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get column template by ID' })
  @ApiResponse({ status: 200, description: 'Column template found' })
  @ApiResponse({ status: 404, description: 'Column template not found' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update column template by ID' })
  @ApiResponse({ status: 200, description: 'Column template updated' })
  @ApiResponse({ status: 404, description: 'Column template not found' })
  update(@Param('id') id: string, @Body() dto: UpdateColumnTemplateDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete column template by ID' })
  @ApiResponse({ status: 200, description: 'Column template deleted' })
  @ApiResponse({ status: 404, description: 'Column template not found' })
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }
}
