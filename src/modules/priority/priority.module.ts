import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { PriorityController } from './priority.controller'
import { PriorityRepository } from './priority.repository'
import { PriorityService } from './priority.service'

@Module({
  controllers: [PriorityController],
  providers: [
    { provide: 'IPriorityService', useClass: PriorityService },
    { provide: 'IPriorityRepository', useClass: PriorityRepository },
    PermissionService,
    PrismaService
  ],
  exports: [{ provide: 'IPriorityService', useClass: PriorityService }]
})
export class PriorityModule {}
