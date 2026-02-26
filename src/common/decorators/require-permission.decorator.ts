import { SetMetadata } from '@nestjs/common'
import {
  ModuleType,
  PermissionAction
} from '../interfaces/permission.interface'

export interface PermissionMetadata {
  module: ModuleType
  action: PermissionAction
  useResourceId?: boolean
}

export const PERMISSION_KEY = 'permission'

export const RequirePermission = (
  module: ModuleType,
  action: PermissionAction,
  useResourceId: boolean = false
) => {
  const metadata: PermissionMetadata = { module, action, useResourceId }
  return SetMetadata(PERMISSION_KEY, metadata)
}
