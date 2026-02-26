import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { PrismaService } from '../prisma/prisma.service'
import {
  AssignUserRoleDto,
  DeleteUserDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'
import type { IUserRepository, IUserService } from './user.interface'

@Injectable()
export class UserService implements IUserService {
  constructor(
    @Inject('IUserRepository')
    private userRepository: IUserRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    private prisma: PrismaService
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return user
  }

  async updateProfile(userId: string, data: UpdateOwnProfileDto) {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Only allow updating specific fields
    const allowedFields: Partial<UpdateOwnProfileDto> = {
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
      display_image: data.display_image,
      contact_number: data.contact_number
    }

    // Remove undefined fields
    Object.keys(allowedFields).forEach(key => {
      if (allowedFields[key as keyof UpdateOwnProfileDto] === undefined) {
        delete allowedFields[key as keyof UpdateOwnProfileDto]
      }
    })

    return this.userRepository.update(userId, allowedFields)
  }

  async findOne(id: string, currentUser: IUserWithPermissions) {
    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if user has permission to view this user
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this user')
    }

    return user
  }

  async update(
    id: string,
    data: UpdateUserDto,
    currentUser: IUserWithPermissions
  ) {
    // Only super admins can update users
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can update users')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Prepare update data
    const updateData: any = {}
    if (data.first_name) updateData.first_name = data.first_name
    if (data.last_name) updateData.last_name = data.last_name
    if (data.email) updateData.email = data.email
    if (data.language) updateData.language = data.language
    if (data.display_image !== undefined)
      updateData.display_image = data.display_image
    if (data.contact_number !== undefined)
      updateData.contact_number = data.contact_number

    return this.userRepository.update(id, updateData)
  }

  async updateRole(
    id: string,
    data: AssignUserRoleDto,
    currentUser: IUserWithPermissions
  ) {
    // Only super admins can update user roles
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can update user roles')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Prevent users from updating their own role
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot update your own role')
    }

    const newRole = await this.userRepository.findRoleById(data.role_id)

    if (!newRole) {
      throw new NotFoundException('New role not found')
    }

    // Update the role
    return this.userRepository.updateRole(id, data.role_id)
  }

  async remove(
    id: string,
    data: DeleteUserDto,
    currentUser: IUserWithPermissions
  ) {
    // Only super admins can delete users
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can delete users')
    }

    // Prevent users from deleting themselves
    if (currentUser.id === id) {
      throw new BadRequestException('You cannot delete yourself')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Check if the user to be deleted is a super admin
    if (isUserSuperAdmin(user as unknown as IUserWithPermissions)) {
      throw new ForbiddenException('Super admin users cannot be deleted')
    }

    // Verify current user's password
    const currentUserFromDb = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { password: true }
    })

    if (!currentUserFromDb) {
      throw new NotFoundException('Current user not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      data.password,
      currentUserFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    await this.userRepository.delete(id)

    return { message: 'User deleted successfully' }
  }

  async findAll(query: UserQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.USER
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        query.page || 1,
        query.limit || 10
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.user_role_id) {
      additionalFilters.user_role_id = query.user_role_id
    }
    if (query.is_verified) {
      additionalFilters.is_verified = query.is_verified
    }

    // Merge with existing filters
    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    // Configuration for query builder
    const queryConfig = {
      searchFields: ['first_name', 'last_name', 'email'],
      filterableFields: ['user_role_id', 'is_verified'],
      sortableFields: [
        'first_name',
        'last_name',
        'email',
        'created_at',
        'updated_at',
        'is_verified'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        role_name: 'role.name'
      }
    }

    // Build base where clause with permission filter
    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : {
            id: {
              in: accessibleIds
            }
          }

    // Build Prisma query options
    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.userRepository.findAll({ where, skip, take, orderBy }, undefined),
      this.userRepository.count(where, undefined)
    ])

    return QueryBuilder.buildPaginatedResult(
      data,
      total,
      query.page || 1,
      query.limit || 10
    )
  }
}
