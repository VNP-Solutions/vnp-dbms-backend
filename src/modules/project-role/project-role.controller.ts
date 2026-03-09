import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CreateProjectRoleDto, UpdateProjectRoleDto } from './project-role.dto'
import type { IProjectRoleService } from './project-role.interface'

@ApiTags('Project Roles')
@ApiBearerAuth('JWT-auth')
@Controller('project-roles')
export class ProjectRoleController {
  constructor(
    @Inject('IProjectRoleService')
    private readonly projectRoleService: IProjectRoleService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project role' })
  @ApiResponse({ status: 201, description: 'Project role created successfully' })
  @ApiResponse({ status: 409, description: 'Project role already exists' })
  async create(@Body() createProjectRoleDto: CreateProjectRoleDto) {
    return this.projectRoleService.create(createProjectRoleDto)
  }

  @Get()
  @ApiOperation({ summary: 'Get all project roles' })
  @ApiResponse({ status: 200, description: 'List of project roles' })
  async findAll() {
    return this.projectRoleService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project role by ID' })
  @ApiResponse({ status: 200, description: 'Project role found' })
  @ApiResponse({ status: 404, description: 'Project role not found' })
  async findOne(@Param('id') id: string) {
    return this.projectRoleService.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project role by ID' })
  @ApiResponse({ status: 200, description: 'Project role updated' })
  @ApiResponse({ status: 404, description: 'Project role not found' })
  async update(
    @Param('id') id: string,
    @Body() updateProjectRoleDto: UpdateProjectRoleDto
  ) {
    return this.projectRoleService.update(id, updateProjectRoleDto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project role by ID' })
  @ApiResponse({ status: 200, description: 'Project role deleted' })
  @ApiResponse({ status: 404, description: 'Project role not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete project role with assigned users' })
  async remove(@Param('id') id: string) {
    return this.projectRoleService.remove(id)
  }
}
