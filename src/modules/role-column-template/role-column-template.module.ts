import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RoleColumnTemplateController } from './role-column-template.controller'
import { RoleColumnTemplateRepository } from './role-column-template.repository'
import { RoleColumnTemplateService } from './role-column-template.service'

@Module({
  controllers: [RoleColumnTemplateController],
  providers: [
    { provide: 'IRoleColumnTemplateService', useClass: RoleColumnTemplateService },
    { provide: 'IRoleColumnTemplateRepository', useClass: RoleColumnTemplateRepository },
    PrismaService
  ],
  exports: [{ provide: 'IRoleColumnTemplateService', useClass: RoleColumnTemplateService }]
})
export class RoleColumnTemplateModule {}
