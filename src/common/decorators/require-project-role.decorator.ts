import { SetMetadata } from '@nestjs/common'
import { ProjectType } from '@prisma/client'

export const REQUIRE_PROJECT_ROLE_KEY = 'requireProjectRole'

export interface ProjectRoleMetadata {
  projectTypes: ProjectType[]
  allowSuperAdmin?: boolean
}

/**
 * Decorator to require user to have a specific project role
 * @param projectTypes - Array of allowed project types (DASHBOARD, PARSER)
 * @param allowSuperAdmin - Whether to allow super admin access (default: true)
 */
export const RequireProjectRole = (
  projectTypes: ProjectType[],
  allowSuperAdmin = true
) => SetMetadata(REQUIRE_PROJECT_ROLE_KEY, { projectTypes, allowSuperAdmin })
