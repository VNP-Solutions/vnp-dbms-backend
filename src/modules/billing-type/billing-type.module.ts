import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { BillingTypeController } from './billing-type.controller'
import { BillingTypeRepository } from './billing-type.repository'
import { BillingTypeService } from './billing-type.service'

@Module({
  controllers: [BillingTypeController],
  providers: [
    { provide: 'IBillingTypeService', useClass: BillingTypeService },
    { provide: 'IBillingTypeRepository', useClass: BillingTypeRepository },
    PermissionService,
    PrismaService
  ],
  exports: [{ provide: 'IBillingTypeService', useClass: BillingTypeService }]
})
export class BillingTypeModule {}
