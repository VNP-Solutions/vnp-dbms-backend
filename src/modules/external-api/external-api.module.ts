import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { RunDateCalculatorService } from '../../common/services/run-date-calculator.service'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { PrismaService } from '../prisma/prisma.service'
import { ExternalPortfolioController } from './external-portfolio.controller'
import { ExternalPortfolioService } from './external-portfolio.service'
import { ExternalPropertyController } from './external-property.controller'
import { ExternalPropertyServiceController } from './external-property-service.controller'
import { ExternalPropertyService } from './external-property.service'
import { ExternalLambdaTriggerController } from './external-lambda-trigger.controller'
import { ExternalRecurringJobsController } from './external-recurring-jobs.controller'
import { ExternalRecurringJobsService } from './external-recurring-jobs.service'
import { ExternalSubportfolioController } from './external-subportfolio.controller'
import { ExternalSubportfolioService } from './external-subportfolio.service'

@Module({
  imports: [ConfigModule, PortfolioModule, JwtModule.register({})],
  controllers: [
    ExternalPortfolioController,
    ExternalPropertyController,
    ExternalPropertyServiceController,
    ExternalSubportfolioController,
    ExternalRecurringJobsController,
    ExternalLambdaTriggerController
  ],
  providers: [
    PrismaService,
    RunDateCalculatorService,
    ExternalJwtGuard,
    ExternalPortfolioService,
    ExternalPropertyService,
    ExternalSubportfolioService,
    ExternalRecurringJobsService
  ],
  exports: [
    ExternalPortfolioService,
    ExternalPropertyService,
    ExternalSubportfolioService,
    ExternalRecurringJobsService
  ]
})
export class ExternalApiModule {}
