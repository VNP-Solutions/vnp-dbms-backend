import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PropertyController } from './property.controller'
import { PropertyRepository } from './property.repository'
import { PropertyService } from './property.service'

@Module({
  controllers: [PropertyController],
  providers: [
    { provide: 'IPropertyService', useClass: PropertyService },
    { provide: 'IPropertyRepository', useClass: PropertyRepository },
    PrismaService
  ],
  exports: [{ provide: 'IPropertyService', useClass: PropertyService }]
})
export class PropertyModule {}
