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
  ManageUserAccessDto,
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
      contact_number: data.contact_number,
      job_title: data.job_title,
      phone_number: data.phone_number
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
    const result = await this.userRepository.findUserWithAccessibleResources(id)

    if (!result || !result.user) {
      throw new NotFoundException('User not found')
    }

    const { user, properties, portfolios, userProjectRoles } = result

    // Check if user has permission to view this user
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      currentUser,
      ModuleType.USER
    )

    if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
      throw new ForbiddenException('You do not have access to this user')
    }

    // Remove the raw userAccessedProperties and userProjectRoles and return with formatted data
    const { userAccessedProperties: _, userProjectRoles: __, ...userWithoutAccessProps } = user as any

    return {
      ...userWithoutAccessProps,
      userAccessProperties: {
        portfolios,
        properties,
        userProjectRoles
      }
    }
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
    if (data.first_name !== undefined) updateData.first_name = data.first_name
    if (data.last_name !== undefined) updateData.last_name = data.last_name
    if (data.email !== undefined) updateData.email = data.email
    if (data.language !== undefined) updateData.language = data.language
    if (data.display_image !== undefined)
      updateData.display_image = data.display_image
    if (data.contact_number !== undefined)
      updateData.contact_number = data.contact_number
    if (data.job_title !== undefined)
      updateData.job_title = data.job_title
    if (data.phone_number !== undefined)
      updateData.phone_number = data.phone_number

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

  async addAccess(
    id: string,
    data: ManageUserAccessDto,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can manage user access')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (
      (!data.portfolio_ids || data.portfolio_ids.length === 0) &&
      (!data.property_ids || data.property_ids.length === 0)
    ) {
      throw new BadRequestException(
        'Please provide at least one portfolio_id or property_id to add'
      )
    }

    const portfolioAccess = user.role?.portfolio_permission?.access_level
    const propertyAccess = user.role?.property_permission?.access_level

    if (data.portfolio_ids && data.portfolio_ids.length > 0) {
      if (portfolioAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot add portfolio access. User's role has '${portfolioAccess}' access level for portfolios. Only 'partial' access level supports access lists.`
        )
      }
    }

    if (data.property_ids && data.property_ids.length > 0) {
      if (propertyAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot add property access. User's role has '${propertyAccess}' access level for properties. Only 'partial' access level supports access lists.`
        )
      }
    }

    await this.userRepository.addUserAccess(
      id,
      data.portfolio_ids || [],
      data.property_ids || []
    )

    return { message: 'User access added successfully' }
  }

  async revokeAccess(
    id: string,
    data: ManageUserAccessDto,
    currentUser: IUserWithPermissions
  ): Promise<{ message: string }> {
    if (!isUserSuperAdmin(currentUser)) {
      throw new ForbiddenException('Only super admins can manage user access')
    }

    const user = await this.userRepository.findById(id)

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (
      (!data.portfolio_ids || data.portfolio_ids.length === 0) &&
      (!data.property_ids || data.property_ids.length === 0)
    ) {
      throw new BadRequestException(
        'Please provide at least one portfolio_id or property_id to revoke'
      )
    }

    const portfolioAccess = user.role?.portfolio_permission?.access_level
    const propertyAccess = user.role?.property_permission?.access_level

    if (data.portfolio_ids && data.portfolio_ids.length > 0) {
      if (portfolioAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot revoke portfolio access. User's role has '${portfolioAccess}' access level for portfolios. Only 'partial' access level uses access lists.`
        )
      }
    }

    if (data.property_ids && data.property_ids.length > 0) {
      if (propertyAccess !== 'partial') {
        throw new BadRequestException(
          `Cannot revoke property access. User's role has '${propertyAccess}' access level for properties. Only 'partial' access level uses access lists.`
        )
      }
    }

    await this.userRepository.revokeUserAccess(
      id,
      data.portfolio_ids || [],
      data.property_ids || []
    )

    return { message: 'User access revoked successfully' }
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
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.USER
    )

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      const usePagination = query.page != null && query.limit != null
      return QueryBuilder.buildPaginatedResult(
        [],
        0,
        1,
        usePagination ? (query.limit || 10) : 0
      )
    }

    // Build additional filters from query params
    const additionalFilters: any = {}
    if (query.user_role_id) {
      additionalFilters.user_role_id = query.user_role_id
    }
    if (query.is_verified !== undefined) {
      additionalFilters.is_verified = query.is_verified
    }

    // Date range filters for created_at
    if (query.created_from || query.created_to) {
      additionalFilters.created_at = {}
      if (query.created_from) {
        additionalFilters.created_at.gte = query.created_from
      }
      if (query.created_to) {
        additionalFilters.created_at.lte = query.created_to
      }
    }

    // Date range filters for updated_at
    if (query.updated_from || query.updated_to) {
      additionalFilters.updated_at = {}
      if (query.updated_from) {
        additionalFilters.updated_at.gte = query.updated_from
      }
      if (query.updated_to) {
        additionalFilters.updated_at.lte = query.updated_to
      }
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
    const { where, skip, take, orderBy, usePagination } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    // Fetch data and count
    const [data, total] = await Promise.all([
      this.userRepository.findAll({ where, skip, take, orderBy }, undefined),
      this.userRepository.count(where, undefined)
    ])

    const page = usePagination ? (query.page || 1) : 1
    const limit = usePagination ? (take || 10) : data.length
    return QueryBuilder.buildPaginatedResult(data, total, page, limit)
  }
}
