import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ProjectType } from '@prisma/client'
import {
  REQUIRE_PROJECT_ROLE_KEY,
  type ProjectRoleMetadata
} from '../decorators/require-project-role.decorator'
import { hasProjectAccess } from '../utils/project-context.util'
import type { IUserWithProjectRole } from '../utils/project-context.util'

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const projectRoleMetadata = this.reflector.getAllAndOverride<
      ProjectRoleMetadata | undefined
    >(REQUIRE_PROJECT_ROLE_KEY, [context.getHandler(), context.getClass()])

    if (!projectRoleMetadata) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user: IUserWithProjectRole = request.user

    if (!user) {
      throw new ForbiddenException('User not authenticated')
    }

    const { projectTypes, allowSuperAdmin } = projectRoleMetadata

    // Super Admin always has access
    if (allowSuperAdmin && user.role.name === 'Super Admin') {
      return true
    }

    // Users with 'all' access in base role have access to all projects
    const hasAllAccessInBaseRole =
      user.role.portfolio_permission?.access_level === 'all' ||
      user.role.property_permission?.access_level === 'all'

    if (hasAllAccessInBaseRole) {
      return true
    }

    // Check if user has specific project role access
    const hasAccess = projectTypes.some(projectType =>
      hasProjectAccess(user, projectType)
    )

    if (!hasAccess) {
      throw new ForbiddenException(
        `Access denied. Required project role: ${projectTypes.join(' or ')}`
      )
    }

    return true
  }
}
