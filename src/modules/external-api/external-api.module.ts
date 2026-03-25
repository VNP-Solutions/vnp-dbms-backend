import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { PrismaService } from '../prisma/prisma.service'
import { ExternalPortfolioController } from './external-portfolio.controller'
import { ExternalPortfolioService } from './external-portfolio.service'
import { ExternalPropertyController } from './external-property.controller'
import { ExternalPropertyService } from './external-property.service'
import { ExternalSubportfolioController } from './external-subportfolio.controller'
import { ExternalSubportfolioService } from './external-subportfolio.service'

@Module({
  imports: [ConfigModule, PortfolioModule],
  controllers: [
    ExternalPortfolioController,
    ExternalPropertyController,
    ExternalSubportfolioController
  ],
  providers: [
    PrismaService,
    ExternalPortfolioService,
    ExternalPropertyService,
    ExternalSubportfolioService
  ],
  exports: [
    ExternalPortfolioService,
    ExternalPropertyService,
    ExternalSubportfolioService
  ]
})
export class ExternalApiModule {}
