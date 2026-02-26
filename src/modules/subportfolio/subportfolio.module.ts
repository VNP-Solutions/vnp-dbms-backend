import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SubportfolioController } from './subportfolio.controller'
import { SubportfolioRepository } from './subportfolio.repository'
import { SubportfolioService } from './subportfolio.service'

@Module({
  controllers: [SubportfolioController],
  providers: [
    { provide: 'ISubportfolioService', useClass: SubportfolioService },
    { provide: 'ISubportfolioRepository', useClass: SubportfolioRepository },
    PrismaService
  ],
  exports: [{ provide: 'ISubportfolioService', useClass: SubportfolioService }]
})
export class SubportfolioModule {}
