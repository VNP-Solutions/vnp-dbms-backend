import { Module } from '@nestjs/common'
import { RedisService } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { PortfolioController } from './portfolio.controller'
import { PortfolioRepository } from './portfolio.repository'
import { PortfolioService } from './portfolio.service'

@Module({
  controllers: [PortfolioController],
  providers: [
    { provide: 'IPortfolioService', useClass: PortfolioService },
    { provide: 'IPortfolioRepository', useClass: PortfolioRepository },
    PrismaService,
    RedisService
  ],
  exports: [{ provide: 'IPortfolioService', useClass: PortfolioService }]
})
export class PortfolioModule {}
