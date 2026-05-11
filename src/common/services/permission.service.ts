import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../modules/prisma/prisma.service'
import {
  AccessLevel,
  IPermission,
  IUserWithPermissions,
  ModuleType,
  PermissionAction,
  PermissionCheckResult,
  PermissionLevel
} from '../interfaces/permission.interface'

/**
 * Permission Service
 *
 * Handles all permission checks for the application.
 *
 * Permission System:
 * - Permission Level: Defines CRUD operations (ALL, UPDATE, VIEW, NONE)
 * - Access Level: Defines resource scope (ALL, PARTIAL, NONE)
 *
 * Permission Level Mapping:
 * - ALL: Create ✓ | Read ✓ | Update ✓ | Delete ✓
 * - UPDATE: Create ✓ | Read ✓ | Update ✓ | Delete ✗
 * - VIEW: Create ✗ | Read ✓ | Update ✗ | Delete ✗
 * - NONE: Create ✗ | Read ✗ | Update ✗ | Delete ✗
 *
 * Access Level Mapping:
 * - ALL: Access all resources in the system
 * - PARTIAL: Access only assigned resources
 * - NONE: No access to any resources
 */
@Injectable()
export class PermissionService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  private readonly permissionMatrix: Record<
    PermissionLevel,
    Record<PermissionAction, boolean>
  > = {
    [PermissionLevel.all]: {
      [PermissionAction.CREATE]: true,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: true
    },
    [PermissionLevel.update]: {
      [PermissionAction.CREATE]: true,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: true,
      [PermissionAction.DELETE]: false
    },
    [PermissionLevel.view]: {
      [PermissionAction.CREATE]: false,
      [PermissionAction.READ]: true,
      [PermissionAction.UPDATE]: false,
      [PermissionAction.DELETE]: false
    }
  }

  checkPermission(
    user: IUserWithPermissions,
    module: ModuleType,
    action: PermissionAction,
    resourceId?: string
  ): PermissionCheckResult {
    const permission = this.getModulePermission(user, module)

    if (!permission) {
      return {
        allowed: false,
        reason: `No permission found for module: ${module}`
      }
    }

    if (permission.access_level === AccessLevel.none) {
      return {
        allowed: false,
        reason: `Access denied: No access to ${module} module`
      }
    }

    const hasActionPermission =
      this.permissionMatrix[permission.permission_level][action]

    if (!hasActionPermission) {
      return {
        allowed: false,
        reason: `Action '${action}' not allowed with permission level '${permission.permission_level}'`
      }
    }

    if (permission.access_level === AccessLevel.all) {
      return { allowed: true }
    }

    if (permission.access_level === AccessLevel.partial) {
      // If no resourceId provided, this is likely a CREATE or LIST operation
      if (!resourceId) {
        // CREATE operations: Allowed
        // LIST operations: Allowed, but service layer must filter results
        return { allowed: true }
      }

      // For specific resource operations (READ/:id, UPDATE/:id, DELETE/:id)
      // Return true - actual check happens in async requirePermission
      return { allowed: true }
    }

    return { allowed: false, reason: 'Unknown permission configuration' }
  }

  async requirePermission(
    user: IUserWithPermissions,
    module: ModuleType,
    action: PermissionAction,
    resourceId?: string
  ): Promise<void> {
    const result = this.checkPermission(user, module, action, resourceId)

    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || 'You do not have permission to perform this action'
      )
    }

    // Additional check for partial access with resourceId
    const permission = this.getModulePermission(user, module)
    if (
      permission &&
      permission.access_level === AccessLevel.partial &&
      resourceId
    ) {
      const hasAccess = await this.checkPartialAccess(user, module, resourceId)
      if (!hasAccess) {
        throw new ForbiddenException(
          `Access denied: Resource not in user's accessible ${module}s`
        )
      }
    }
  }

  async canAccessResource(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): Promise<boolean> {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.none) {
      return false
    }

    if (permission.access_level === AccessLevel.all) {
      return true
    }

    return this.checkPartialAccess(user, module, resourceId)
  }

  getAccessibleResourceIds(
    user: IUserWithPermissions,
    module: ModuleType
  ): string[] | 'all' {
    const permission = this.getModulePermission(user, module)

    if (!permission || permission.access_level === AccessLevel.none) {
      return []
    }

    if (permission.access_level === AccessLevel.all) {
      return 'all'
    }

    // For PARTIAL access, you can extend this logic to query your own access tables
    // For example, if you have a UserAccess table for different resources
    // For now, returning empty array - implement based on your needs
    return []
  }

  private getModulePermission(
    user: IUserWithPermissions,
    module: ModuleType
  ): IPermission | null {
    if (!user?.role) return null

    const role = user.role
    switch (module) {
      case ModuleType.PORTFOLIO:
        return role.portfolio_permission ?? null
      case ModuleType.PROPERTY:
        return role.property_permission ?? null
      case ModuleType.AUDIT:
        return role.audit_permission ?? null
      case ModuleType.USER:
        return role.user_permission ?? null
      case ModuleType.SYSTEM_SETTINGS:
        return role.system_settings_permission ?? null
      case ModuleType.BANK_DETAILS:
        return role.bank_details_permission ?? null
      case ModuleType.ROLES:
        return role.roles_permission ?? null
      case ModuleType.ACCESS_LOGS:
        return role.access_logs_permission ?? null
      default:
        return null
    }
  }

  /**
   * Validate if a module supports partial access
   * Override this method to specify which modules support partial access
   */
  moduleSupportsPartialAccess(module: ModuleType): boolean {
    // By default, USER module supports partial access (users they invited)
    // You can add more modules as needed
    return module === ModuleType.USER
  }

  /**
   * Validate role configuration and return warnings
   * Helps identify potentially problematic permission setups
   */
  validateRoleConfiguration(role: IUserWithPermissions['role']): string[] {
    const warnings: string[] = []

    const permissions: [ModuleType, IPermission | null][] = [
      [ModuleType.PORTFOLIO, role.portfolio_permission],
      [ModuleType.PROPERTY, role.property_permission],
      [ModuleType.AUDIT, role.audit_permission],
      [ModuleType.USER, role.user_permission],
      [ModuleType.SYSTEM_SETTINGS, role.system_settings_permission],
      [ModuleType.BANK_DETAILS, role.bank_details_permission],
      [ModuleType.ROLES, role.roles_permission],
      [ModuleType.ACCESS_LOGS, role.access_logs_permission]
    ]

    for (const [module, permission] of permissions) {
      if (!permission) continue

      // Warn about PARTIAL access on modules that don't support it
      if (
        permission.access_level === AccessLevel.partial &&
        !this.moduleSupportsPartialAccess(module)
      ) {
        warnings.push(
          `${module}: PARTIAL access_level is not fully implemented. This may behave as NO ACCESS.`
        )
      }

      // Warn about potential CREATE issues with PARTIAL access
      if (
        permission.access_level === AccessLevel.partial &&
        (permission.permission_level === PermissionLevel.all ||
          permission.permission_level === PermissionLevel.update)
      ) {
        warnings.push(
          `${module}: Users can CREATE resources. Make sure to implement access control for created resources.`
        )
      }
    }

    return warnings
  }

  private async checkPartialAccess(
    user: IUserWithPermissions,
    module: ModuleType,
    resourceId: string
  ): Promise<boolean> {
    // For USER module with partial access: check if the resource user was invited by current user
    if (module === ModuleType.USER) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: resourceId },
        select: { invited_by_id: true }
      })
      return targetUser?.invited_by_id === user.id
    }

    // For other modules, implement your own access logic
    // You can create access tables similar to UserAccessedProperty
    // For now, return false
    return false
  }
}
