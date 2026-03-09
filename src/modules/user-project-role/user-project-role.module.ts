import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectRoleModule } from '../project-role/project-role.module'
import { UserProjectRoleController } from './user-project-role.controller'
import { UserProjectRoleRepository } from './user-project-role.repository'
import { UserProjectRoleService } from './user-project-role.service'

@Module({
  imports: [ProjectRoleModule],
  controllers: [UserProjectRoleController],
  providers: [
    PrismaService,
    {
      provide: 'IUserProjectRoleRepository',
      useClass: UserProjectRoleRepository
    },
    {
      provide: 'IUserProjectRoleService',
      useClass: UserProjectRoleService
    }
  ],
  exports: ['IUserProjectRoleRepository', 'IUserProjectRoleService']
})
export class UserProjectRoleModule {}
