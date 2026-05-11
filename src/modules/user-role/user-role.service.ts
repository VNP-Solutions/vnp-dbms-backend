import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import type {
  IUserWithPermissions,
  IUserRoleWithPermissions
} from '../../common/interfaces/permission.interface'
import { ModuleType } from '../../common/interfaces/permission.interface'
import { PermissionService } from '../../common/services/permission.service'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserRoleDto, ReorderUserRoleDto, UpdateUserRoleDto } from './user-role.dto'
import type {
  IUserRoleRepository,
  IUserRoleService
} from './user-role.interface'

@Injectable()
export class UserRoleService implements IUserRoleService {
  private readonly logger = new Logger(UserRoleService.name)

  constructor(
    @Inject('IUserRoleRepository')
    private userRoleRepository: IUserRoleRepository,
    @Inject(PermissionService)
    private permissionService: PermissionService,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(data: CreateUserRoleDto, _user: IUserWithPermissions) {
    const existingRole = await this.userRoleRepository.findByName(data.name)

    if (existingRole) {
      throw new ConflictException('Role with this name already exists')
    }

    // Validate role configuration and log warnings
    const roleToValidate: IUserRoleWithPermissions = {
      id: '',
      name: data.name,
      is_external: data.is_external,
      can_access_mis: data.can_access_mis ?? false,
      portfolio_permission: data.portfolio_permission ?? null,
      property_permission: data.property_permission ?? null,
      audit_permission: data.audit_permission ?? null,
      user_permission: data.user_permission ?? null,
      system_settings_permission: data.system_settings_permission ?? null,
      bank_details_permission: data.bank_details_permission ?? null,
      roles_permission: data.roles_permission ?? null,
      access_logs_permission: data.access_logs_permission ?? null
    }
    const warnings = this.permissionService.validateRoleConfiguration(roleToValidate)

    if (warnings.length > 0) {
      this.logger.warn(`Creating role "${data.name}" with potential issues:`)
      warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
    }

    return this.userRoleRepository.create(data)
  }

  async findAll(user: IUserWithPermissions) {
    const accessibleIds = this.permissionService.getAccessibleResourceIds(
      user,
      ModuleType.ROLES
    )

    if (accessibleIds === 'all') {
      // User has full access - return all roles
      return this.userRoleRepository.findAll()
    }

    // User has 'partial' or 'none' access
    // Since USER module doesn't support partial access, return empty array
    return []
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    return userRole
  }

  async update(
    id: string,
    data: UpdateUserRoleDto,
    _user: IUserWithPermissions
  ) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    if (data.name && data.name !== userRole.name) {
      const existingRole = await this.userRoleRepository.findByName(data.name)

      if (existingRole) {
        throw new ConflictException('Role with this name already exists')
      }
    }

    // Validate updated role configuration (merge data over existing role)
    const roleToValidate: IUserRoleWithPermissions = {
      id: userRole.id,
      name: data.name ?? userRole.name,
      is_external: data.is_external ?? userRole.is_external,
      can_access_mis: data.can_access_mis ?? userRole.can_access_mis,
      portfolio_permission:
        data.portfolio_permission ?? userRole.portfolio_permission ?? null,
      property_permission:
        data.property_permission ?? userRole.property_permission ?? null,
      audit_permission: data.audit_permission ?? userRole.audit_permission ?? null,
      user_permission: data.user_permission ?? userRole.user_permission ?? null,
      system_settings_permission:
        data.system_settings_permission ??
        userRole.system_settings_permission ??
        null,
      bank_details_permission:
        data.bank_details_permission ??
        userRole.bank_details_permission ??
        null,
      roles_permission:
        data.roles_permission ?? userRole.roles_permission ?? null,
      access_logs_permission:
        data.access_logs_permission ?? userRole.access_logs_permission ?? null
    }
    const warnings = this.permissionService.validateRoleConfiguration(roleToValidate)

    if (warnings.length > 0) {
      this.logger.warn(
        `Updating role "${userRole.name}" with potential issues:`
      )
      warnings.forEach(warning => this.logger.warn(`  - ${warning}`))
    }

    return this.userRoleRepository.update(id, data)
  }

  async remove(id: string, password: string, user: IUserWithPermissions) {
    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    const userCount = await this.userRoleRepository.countUsers(id)

    if (userCount > 0) {
      throw new BadRequestException(
        `Cannot delete role with ${userCount} assigned users. Please reassign the users first.`
      )
    }

    await this.userRoleRepository.delete(id)

    return { message: 'Role deleted successfully' }
  }

  async reorder(id: string, data: ReorderUserRoleDto, _user: IUserWithPermissions) {
    const userRole = await this.userRoleRepository.findById(id)

    if (!userRole) {
      throw new NotFoundException('Role not found')
    }

    const currentOrder = userRole.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Role order unchanged' }
    }

    // Get all user roles sorted by order
    const allRoles = await this.userRoleRepository.findAll()

    // Prepare updates
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      // Moving down: shift items up between currentOrder and newOrder
      allRoles.forEach(role => {
        if (role.id === id) {
          updates.push({ id: role.id, order: newOrder })
        } else if (role.order > currentOrder && role.order <= newOrder) {
          updates.push({ id: role.id, order: role.order - 1 })
        }
      })
    } else {
      // Moving up: shift items down between newOrder and currentOrder
      allRoles.forEach(role => {
        if (role.id === id) {
          updates.push({ id: role.id, order: newOrder })
        } else if (role.order >= newOrder && role.order < currentOrder) {
          updates.push({ id: role.id, order: role.order + 1 })
        }
      })
    }

    await this.userRoleRepository.updateMany(updates)

    return { message: 'Role order updated successfully' }
  }
}
