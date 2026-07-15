import { Inject, Injectable } from '@nestjs/common'
import { ColumnTemplate } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'
import type { IColumnTemplateRepository } from './column-template.interface'

@Injectable()
export class ColumnTemplateRepository implements IColumnTemplateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: CreateColumnTemplateDto): Promise<ColumnTemplate> {
    return this.prisma.columnTemplate.create({ data })
  }

  findAll(): Promise<ColumnTemplate[]> {
    return this.prisma.columnTemplate.findMany({ orderBy: { created_at: 'desc' } })
  }

  findById(id: string): Promise<ColumnTemplate | null> {
    return this.prisma.columnTemplate.findUnique({ where: { id } })
  }

  findByUserId(userId: string): Promise<ColumnTemplate[]> {
    return this.prisma.columnTemplate.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    })
  }

  findByRoleId(roleId: string): Promise<ColumnTemplate[]> {
    return this.prisma.columnTemplate.findMany({
      where: { role_id: roleId },
      orderBy: { created_at: 'desc' }
    })
  }

  update(id: string, data: UpdateColumnTemplateDto): Promise<ColumnTemplate> {
    return this.prisma.columnTemplate.update({ where: { id }, data })
  }

  delete(id: string): Promise<ColumnTemplate> {
    return this.prisma.columnTemplate.delete({ where: { id } })
  }
}
