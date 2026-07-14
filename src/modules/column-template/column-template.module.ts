import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ColumnTemplateController } from './column-template.controller'
import { ColumnTemplateRepository } from './column-template.repository'
import { ColumnTemplateService } from './column-template.service'

@Module({
  controllers: [ColumnTemplateController],
  providers: [
    { provide: 'IColumnTemplateService', useClass: ColumnTemplateService },
    { provide: 'IColumnTemplateRepository', useClass: ColumnTemplateRepository },
    PrismaService
  ],
  exports: [{ provide: 'IColumnTemplateService', useClass: ColumnTemplateService }]
})
export class ColumnTemplateModule {}
