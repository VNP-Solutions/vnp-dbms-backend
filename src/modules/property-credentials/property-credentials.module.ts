import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyCredentialsController } from './property-credentials.controller'
import { PropertyCredentialsRepository } from './property-credentials.repository'
import { PropertyCredentialsService } from './property-credentials.service'

@Module({
  imports: [ConfigModule],
  controllers: [PropertyCredentialsController],
  providers: [
    {
      provide: 'IPropertyCredentialsService',
      useClass: PropertyCredentialsService
    },
    {
      provide: 'IPropertyCredentialsRepository',
      useClass: PropertyCredentialsRepository
    },
    PrismaService,
    EncryptionUtil,
    Logger
  ],
  exports: [
    {
      provide: 'IPropertyCredentialsService',
      useClass: PropertyCredentialsService
    }
  ]
})
export class PropertyCredentialsModule {}
