import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { CurrencyController } from './currency.controller'
import { CurrencyRepository } from './currency.repository'
import { CurrencyService } from './currency.service'

@Module({
  controllers: [CurrencyController],
  providers: [
    {
      provide: 'ICurrencyService',
      useClass: CurrencyService
    },
    {
      provide: 'ICurrencyRepository',
      useClass: CurrencyRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: [
    {
      provide: 'ICurrencyService',
      useClass: CurrencyService
    }
  ]
})
export class CurrencyModule {}
