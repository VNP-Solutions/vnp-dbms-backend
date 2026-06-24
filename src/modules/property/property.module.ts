import { Module, forwardRef } from '@nestjs/common'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { AuthModule } from '../auth/auth.module'
import { PropertyCredentialsModule } from '../property-credentials/property-credentials.module'
import { PortfolioModule } from '../portfolio/portfolio.module'
import { RedisService } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyController, PropertySyncController } from './property.controller'
import { PropertyExpediaCheckerService } from './property-expedia-checker.service'
import { PropertyRepository } from './property.repository'
import { PropertyService } from './property.service'
import { ServiceTokenGuard } from './guards/service-token.guard'

@Module({
  imports: [AuthModule, PropertyCredentialsModule, forwardRef(() => PortfolioModule)],
  controllers: [PropertySyncController, PropertyController],
  providers: [
    { provide: 'IPropertyService', useClass: PropertyService },
    { provide: 'IPropertyRepository', useClass: PropertyRepository },
    PrismaService,
    EncryptionUtil,
    RedisService,
    EmailUtil,
    ServiceTokenGuard,
    PropertyExpediaCheckerService
  ],
  exports: [{ provide: 'IPropertyService', useClass: PropertyService }]
})
export class PropertyModule {}
