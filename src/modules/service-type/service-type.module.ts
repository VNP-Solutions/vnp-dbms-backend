import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { ServiceTypeController } from './service-type.controller'
import { ServiceTypeRepository } from './service-type.repository'
import { ServiceTypeService } from './service-type.service'

@Module({
  controllers: [ServiceTypeController],
  providers: [
    {
      provide: 'IServiceTypeService',
      useClass: ServiceTypeService
    },
    {
      provide: 'IServiceTypeRepository',
      useClass: ServiceTypeRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'IServiceTypeService',
      useClass: ServiceTypeService
    }
  ]
})
export class ServiceTypeModule {}
