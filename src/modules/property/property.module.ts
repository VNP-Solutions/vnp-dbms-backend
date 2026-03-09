import { Module } from '@nestjs/common'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PropertyCredentialsModule } from '../property-credentials/property-credentials.module'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyController } from './property.controller'
import { PropertyRepository } from './property.repository'
import { PropertyService } from './property.service'

@Module({
  imports: [PropertyCredentialsModule],
  controllers: [PropertyController],
  providers: [
    { provide: 'IPropertyService', useClass: PropertyService },
    { provide: 'IPropertyRepository', useClass: PropertyRepository },
    PrismaService,
    EncryptionUtil
  ],
  exports: [{ provide: 'IPropertyService', useClass: PropertyService }]
})
export class PropertyModule {}
