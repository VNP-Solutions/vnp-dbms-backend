import { Global, Module } from '@nestjs/common'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'

/**
 * PermissionModule
 *
 * Registered as @Global() so that PermissionService and PermissionGuard
 * are available across every module in the application without needing
 * to be explicitly imported in each feature module.
 *
 * PermissionGuard is also exported so it can be referenced by
 * AppModule when registering it as a global APP_GUARD.
 */
@Global()
@Module({
  providers: [PermissionService, PermissionGuard, PrismaService],
  exports: [PermissionService, PermissionGuard]
})
export class PermissionModule {}
