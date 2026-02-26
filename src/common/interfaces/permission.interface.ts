import { AccessLevel, PermissionLevel } from '@prisma/client'

// Re-export Prisma enums for convenience
export { AccessLevel, PermissionLevel }

/**
 * Permission Level defines what CRUD operations a user can perform:
 * - all: Full CRUD (Create, Read, Update, Delete) ✓✓✓✓
 * - update: CRU (Create, Read, Update) - no Delete ✓✓✓✗
 * - view: R (Read only) ✗✓✗✗
 * (No access = null permission or access_level none)
 */

/**
 * Access Level defines which resources a user can access:
 * - all: Access all resources in the system
 * - partial: Access only assigned resources
 * - none: No access to any resources
 */

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete'
}

/**
 * Module Type represents different system modules.
 * Aligned with UserRole permission fields in schema.
 */
export enum ModuleType {
  PORTFOLIO = 'portfolio',
  PROPERTY = 'property',
  AUDIT = 'audit',
  USER = 'user',
  SYSTEM_SETTINGS = 'system_settings',
  BANK_DETAILS = 'bank_details'
}

export interface IPermission {
  permission_level: PermissionLevel
  access_level: AccessLevel
}

/** Role shape matching Prisma UserRole (typed permissions per module) */
export interface IUserRoleWithPermissions {
  id: string
  name: string
  is_external: boolean
  can_access_mis?: boolean
  portfolio_permission: IPermission | null
  property_permission: IPermission | null
  audit_permission: IPermission | null
  user_permission: IPermission | null
  system_settings_permission: IPermission | null
  bank_details_permission: IPermission | null
}

export interface IUserWithPermissions {
  id: string
  email: string
  user_role_id: string
  role: IUserRoleWithPermissions
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}
