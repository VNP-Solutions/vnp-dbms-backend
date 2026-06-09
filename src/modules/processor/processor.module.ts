import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { ProcessorController } from './processor.controller'
import { ProcessorRepository } from './processor.repository'
import { ProcessorService } from './processor.service'

@Module({
  controllers: [ProcessorController],
  providers: [
    { provide: 'IProcessorService', useClass: ProcessorService },
    { provide: 'IProcessorRepository', useClass: ProcessorRepository },
    PermissionService,
    PrismaService
  ],
  exports: [{ provide: 'IProcessorService', useClass: ProcessorService }]
})
export class ProcessorModule {}
