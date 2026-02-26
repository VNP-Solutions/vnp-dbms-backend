import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UserRoleController } from './user-role.controller'
import { UserRoleRepository } from './user-role.repository'
import { UserRoleService } from './user-role.service'

@Module({
  controllers: [UserRoleController],
  providers: [
    {
      provide: 'IUserRoleService',
      useClass: UserRoleService
    },
    {
      provide: 'IUserRoleRepository',
      useClass: UserRoleRepository
    },
    PrismaService
  ],
  exports: [
    {
      provide: 'IUserRoleService',
      useClass: UserRoleService
    }
  ]
})
export class UserRoleModule {}
