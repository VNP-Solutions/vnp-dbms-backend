import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { FrequencyController } from './frequency.controller'
import { FrequencyRepository } from './frequency.repository'
import { FrequencyService } from './frequency.service'

@Module({
  controllers: [FrequencyController],
  providers: [
    { provide: 'IFrequencyService', useClass: FrequencyService },
    { provide: 'IFrequencyRepository', useClass: FrequencyRepository },
    PermissionService,
    PrismaService
  ],
  exports: [{ provide: 'IFrequencyService', useClass: FrequencyService }]
})
export class FrequencyModule {}
