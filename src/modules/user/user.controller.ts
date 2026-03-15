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
  AssignUserRoleDto,
  DeleteUserDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'
import type { IUserService } from './user.interface'

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserController {
  constructor(
    @Inject('IUserService')
    private readonly userService: IUserService
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  getProfile(@CurrentUser() user: IUserWithPermissions) {
    // return this.userService.getProfile(user.id)
    return user
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update own profile (cannot update role or sensitive fields)'
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateProfile(
    @Body() updateOwnProfileDto: UpdateOwnProfileDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userService.updateProfile(user.id, updateOwnProfileDto)
  }

  @Get()
  @RequirePermission(ModuleType.USER, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all users accessible to the current user with pagination, search, filter, and sort'
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users retrieved successfully'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  findAll(
    @ParseQuery() query: UserQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userService.findAll(query, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.USER, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No access to this user'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.userService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.USER, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update a user, super admin can do this'
  })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot update own role'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can update users'
  })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userService.update(id, updateUserDto, user)
  }

  @Patch(':id/role')
  @RequirePermission(ModuleType.USER, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update user role (super admin only, cannot update own role)'
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot update own role'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only super admins can update user roles'
  })
  updateRole(
    @Param('id') id: string,
    @Body() assignUserRoleDto: AssignUserRoleDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userService.updateRole(id, assignUserRoleDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.USER, PermissionAction.DELETE, true)
  @ApiOperation({
    summary:
      'Delete a user (super admin only, requires password verification, cannot delete self or other super admins)'
  })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Cannot delete yourself or invalid password'
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - Only super admins can delete users, super admin users cannot be deleted'
  })
  remove(
    @Param('id') id: string,
    @Body() deleteUserDto: DeleteUserDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.userService.remove(id, deleteUserDto, user)
  }
}
