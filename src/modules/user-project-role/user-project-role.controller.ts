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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  AssignProjectRoleDto,
  CreateUserProjectRoleDto,
  UpdateUserProjectRoleDto
} from './user-project-role.dto'
import type { IUserProjectRoleService } from './user-project-role.interface'

@ApiTags('User Project Roles')
@ApiBearerAuth('JWT-auth')
@Controller('user-project-roles')
export class UserProjectRoleController {
  constructor(
    @Inject('IUserProjectRoleService')
    private readonly userProjectRoleService: IUserProjectRoleService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user project role assignment' })
  @ApiResponse({ status: 201, description: 'User project role created successfully' })
  @ApiResponse({ status: 409, description: 'User already has a role for this project' })
  @ApiResponse({ status: 404, description: 'Project role or user not found' })
  async create(
    @Body() createUserProjectRoleDto: CreateUserProjectRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.create(createUserProjectRoleDto, user)
  }

  @Post('assign')
  @ApiOperation({ summary: 'Assign or update project role for a user' })
  @ApiResponse({ status: 201, description: 'Project role assigned successfully' })
  @ApiResponse({ status: 404, description: 'User, role, or project role not found' })
  async assignProjectRole(
    @Body() assignProjectRoleDto: AssignProjectRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.assignProjectRole(
      assignProjectRoleDto.user_id,
      assignProjectRoleDto.project_type,
      assignProjectRoleDto.user_role_id,
      {
        portfolio_ids: assignProjectRoleDto.portfolio_ids,
        subportfolio_ids: assignProjectRoleDto.subportfolio_ids,
        property_ids: assignProjectRoleDto.property_ids
      },
      user
    )
  }

  @Get()
  @ApiOperation({ summary: 'Get all user project roles (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all user project roles' })
  @ApiResponse({ status: 403, description: 'Only super admins can view all project roles' })
  async findAll(
    @ParseQuery() _query: Record<string, any>,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.findAll(user)
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get project roles for a specific user' })
  @ApiResponse({ status: 200, description: 'List of user project roles' })
  @ApiResponse({ status: 403, description: 'You can only view your own project roles' })
  async findByUser(
    @Param('userId') userId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.findByUser(userId, user)
  }

  @Get('user/:userId/project/:projectType')
  @ApiOperation({ summary: 'Get user project role for a specific project type' })
  @ApiQuery({ name: 'projectType', enum: ProjectType })
  @ApiResponse({ status: 200, description: 'User project role details' })
  @ApiResponse({ status: 404, description: 'Project role not found' })
  async findByUserAndProject(
    @Param('userId') userId: string,
    @Param('projectType') projectType: ProjectType,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.findByUserAndProject(
      userId,
      projectType,
      user
    )
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user project role by ID' })
  @ApiResponse({ status: 200, description: 'User project role updated successfully' })
  @ApiResponse({ status: 404, description: 'User project role not found' })
  @ApiResponse({ status: 403, description: 'Only super admins can update project roles' })
  async update(
    @Param('id') id: string,
    @Body() updateUserProjectRoleDto: UpdateUserProjectRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.update(
      id,
      updateUserProjectRoleDto,
      user
    )
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user project role by ID' })
  @ApiResponse({ status: 200, description: 'User project role deleted successfully' })
  @ApiResponse({ status: 404, description: 'User project role not found' })
  @ApiResponse({ status: 403, description: 'Only super admins can delete project roles' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userProjectRoleService.remove(id, user)
  }
}
