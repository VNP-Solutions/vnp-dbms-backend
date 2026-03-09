import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectRoleController } from './project-role.controller'
import { ProjectRoleRepository } from './project-role.repository'
import { ProjectRoleService } from './project-role.service'

@Module({
  controllers: [ProjectRoleController],
  providers: [
    PrismaService,
    {
      provide: 'IProjectRoleRepository',
      useClass: ProjectRoleRepository
    },
    {
      provide: 'IProjectRoleService',
      useClass: ProjectRoleService
    }
  ],
  exports: ['IProjectRoleRepository', 'IProjectRoleService']
})
export class ProjectRoleModule {}
