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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  CreateUserRoleDto,
  DeleteUserRoleDto,
  ReorderUserRoleDto,
  UpdateUserRoleDto
} from './user-role.dto'
import type { IUserRoleService } from './user-role.interface'

@ApiTags('User Role')
@ApiBearerAuth('JWT-auth')
@Controller('user-role')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserRoleController {
  constructor(
    @Inject('IUserRoleService')
    private readonly userRoleService: IUserRoleService
  ) {}

  @Post()
  @RequirePermission(ModuleType.ROLES, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createUserRoleDto: CreateUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.create(createUserRoleDto, user)
  }

  @Get()
  @RequirePermission(ModuleType.ROLES, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Each role includes user_count (number of users assigned to that role).'
  })
  @ApiResponse({
    status: 200,
    description: 'List of roles retrieved successfully (includes user_count per role)'
  })
  findAll(
    @ParseQuery() _query: Record<string, any>,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.findAll(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.ROLES, PermissionAction.READ, true)
  @ApiOperation({
    summary: 'Get a role by ID',
    description:
      'Includes assigned users and user_count (same total as users.length).'
  })
  @ApiResponse({
    status: 200,
    description: 'Role retrieved successfully (includes users and user_count)'
  })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this role'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.userRoleService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.ROLES, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.update(id, updateUserRoleDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.ROLES, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a role (requires password verification)' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete role with assigned users or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deleteUserRoleDto: DeleteUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.remove(id, deleteUserRoleDto.password, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.ROLES, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Reorder a role' })
  @ApiResponse({ status: 200, description: 'Role order updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  reorder(
    @Param('id') id: string,
    @Body() reorderUserRoleDto: ReorderUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userRoleService.reorder(id, reorderUserRoleDto, user)
  }
}
