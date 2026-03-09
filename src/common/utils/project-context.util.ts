import { ProjectType } from '@prisma/client'
import type { IUserWithPermissions } from '../interfaces/permission.interface'

export interface IProjectContext {
  projectType: ProjectType
  user: IUserWithPermissions
}

export interface IUserWithProjectRole extends IUserWithPermissions {
  projectRoles?: Array<{
    project_type: ProjectType
    user_role_id: string
    user_role: {
      id: string
      name: string
      description: string
      is_external: boolean
      can_access_mis: boolean
      portfolio_permission: any
      property_permission: any
      audit_permission: any
      user_permission: any
      system_settings_permission: any
      bank_details_permission: any
    }
    portfolio_ids: string[]
    subportfolio_ids: string[]
    property_ids: string[]
    is_active: boolean
  }>
}

/**
 * Get the effective role for a user in a specific project context
 * If project context is provided, returns the project-specific role
 * Otherwise, returns the user's default DBMS role
 */
export function getEffectiveRole(
  user: IUserWithProjectRole,
  projectType?: ProjectType
) {
  // If no project type specified, use default DBMS role
  if (!projectType || projectType === ProjectType.DBMS) {
    return user.role
  }

  // If user has 'all' access in base role, they have full access to all projects
  const hasAllAccessInBaseRole =
    user.role.portfolio_permission?.access_level === 'all' ||
    user.role.property_permission?.access_level === 'all'

  if (hasAllAccessInBaseRole) {
    return user.role
  }

  // Find project-specific role
  const projectRole = user.projectRoles?.find(
    pr => pr.project_type === projectType && pr.is_active
  )

  // If user has a project-specific role, return it
  if (projectRole?.user_role) {
    return {
      id: projectRole.user_role.id,
      name: projectRole.user_role.name,
      is_external: projectRole.user_role.is_external,
      can_access_mis: projectRole.user_role.can_access_mis,
      portfolio_permission: projectRole.user_role.portfolio_permission,
      property_permission: projectRole.user_role.property_permission,
      audit_permission: projectRole.user_role.audit_permission,
      user_permission: projectRole.user_role.user_permission,
      system_settings_permission:
        projectRole.user_role.system_settings_permission,
      bank_details_permission: projectRole.user_role.bank_details_permission
    }
  }

  // If no project-specific role found, user has no access to this project
  return null
}

/**
 * Check if user has access to a specific project
 */
export function hasProjectAccess(
  user: IUserWithProjectRole,
  projectType: ProjectType
): boolean {
  // Users always have access to DBMS (their default project)
  if (projectType === ProjectType.DBMS) {
    return true
  }

  // Check if user has 'all' access in their base role (Super Admin, etc.)
  const hasAllAccessInBaseRole =
    user.role.portfolio_permission?.access_level === 'all' ||
    user.role.property_permission?.access_level === 'all'

  if (hasAllAccessInBaseRole) {
    return true
  }

  // Check if user has an active role for the specific project
  const projectRole = user.projectRoles?.find(
    pr => pr.project_type === projectType && pr.is_active
  )

  return !!projectRole
}

/**
 * Get accessible resource IDs for a user in a specific project context
 */
export function getProjectAccessibleResources(
  user: IUserWithProjectRole,
  projectType: ProjectType
): {
  portfolio_ids: string[] | 'all'
  subportfolio_ids: string[] | 'all'
  property_ids: string[] | 'all'
} {
  // Check if user has 'all' access in their base DBMS role
  const hasAllAccessInBaseRole =
    user.role.portfolio_permission?.access_level === 'all' ||
    user.role.property_permission?.access_level === 'all'

  if (hasAllAccessInBaseRole) {
    return {
      portfolio_ids: 'all',
      subportfolio_ids: 'all',
      property_ids: 'all'
    }
  }

  // Find project-specific role
  const projectRole = user.projectRoles?.find(
    pr => pr.project_type === projectType && pr.is_active
  )

  if (!projectRole) {
    return {
      portfolio_ids: [],
      subportfolio_ids: [],
      property_ids: []
    }
  }

  // Check if user has 'all' access level in the project-specific role
  const role = projectRole.user_role
  const hasAllAccessInProjectRole =
    role.portfolio_permission?.access_level === 'all' ||
    role.property_permission?.access_level === 'all'

  if (hasAllAccessInProjectRole) {
    return {
      portfolio_ids: 'all',
      subportfolio_ids: 'all',
      property_ids: 'all'
    }
  }

  // Return specific resource IDs from project role
  return {
    portfolio_ids: projectRole.portfolio_ids || [],
    subportfolio_ids: projectRole.subportfolio_ids || [],
    property_ids: projectRole.property_ids || []
  }
}
