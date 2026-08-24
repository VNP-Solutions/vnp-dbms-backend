import { Module, forwardRef } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { S3ExportUtil } from '../../common/utils/s3-export.util'
import { ConfigService } from '../../config/config.service'
import { RunDateCalculatorService } from '../../common/services/run-date-calculator.service'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { SyncActionLogWriter } from '../../common/services/sync-action-log-writer.service'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
import { ExternalRawSecretGuard } from '../../common/guards/external-raw-secret.guard'
import { AuthModule } from '../auth/auth.module'
import { PropertyCredentialsModule } from '../property-credentials/property-credentials.module'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { SubportfolioModule } from '../subportfolio/subportfolio.module'
import { RedisService } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyController, PropertySyncController } from './property.controller'
import { PropertyAgodaCheckerService } from './property-agoda-checker.service'
import { PropertyBookingCheckerService } from './property-booking-checker.service'
import { PropertyExpediaCheckerService } from './property-expedia-checker.service'
import { PropertyRepository } from './property.repository'
import { PropertyService } from './property.service'
import { ServiceTokenGuard } from './guards/service-token.guard'

@Module({
  imports: [
    AuthModule,
    PropertyCredentialsModule,
    forwardRef(() => PortfolioModule),
    SubportfolioModule,
    JwtModule.register({})
  ],
  controllers: [PropertySyncController, PropertyController],
  providers: [
    { provide: 'IPropertyService', useClass: PropertyService },
    { provide: 'IPropertyRepository', useClass: PropertyRepository },
    PrismaService,
    EncryptionUtil,
    RedisService,
    EmailUtil,
    ConfigService,
    S3ExportUtil,
    ServiceTokenGuard,
    PropertyExpediaCheckerService,
    PropertyAgodaCheckerService,
    PropertyBookingCheckerService,
    RunDateCalculatorService,
    SyncCommunicationService,
    SyncActionLogWriter,
    ExternalJwtGuard,
    ExternalRawSecretGuard
  ],
  exports: [{ provide: 'IPropertyService', useClass: PropertyService }]
})
export class PropertyModule {}
