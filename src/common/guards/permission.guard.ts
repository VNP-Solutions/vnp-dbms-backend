import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  PERMISSION_KEY,
  PermissionMetadata
} from '../decorators/require-permission.decorator'
import { IUserWithPermissions } from '../interfaces/permission.interface'
import { PermissionService } from '../services/permission.service'

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PermissionMetadata>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    )

    if (!permission) {
      return true
    }

    const request = context.switchToHttp().getRequest<{
      user: IUserWithPermissions
      params: { id?: string; portfolioId?: string }
    }>()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('User not authenticated')
    }

    let resourceId: string | undefined

    if (permission.useResourceId) {
      resourceId = request.params?.id || request.params?.portfolioId
    }

    const result = this.permissionService.checkPermission(
      user,
      permission.module,
      permission.action,
      resourceId
    )

    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || 'You do not have permission to perform this action'
      )
    }

    return true
  }
}
