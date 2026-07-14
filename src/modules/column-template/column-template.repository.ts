import { Inject, Injectable } from '@nestjs/common'
import { UserColumnTemplate } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'
import type { IColumnTemplateRepository } from './column-template.interface'

@Injectable()
export class ColumnTemplateRepository implements IColumnTemplateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: CreateColumnTemplateDto): Promise<UserColumnTemplate> {
    return this.prisma.userColumnTemplate.create({ data })
  }

  findAll(): Promise<UserColumnTemplate[]> {
    return this.prisma.userColumnTemplate.findMany({ orderBy: { created_at: 'desc' } })
  }

  findById(id: string): Promise<UserColumnTemplate | null> {
    return this.prisma.userColumnTemplate.findUnique({ where: { id } })
  }

  findByUserId(userId: string): Promise<UserColumnTemplate[]> {
    return this.prisma.userColumnTemplate.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    })
  }

  update(id: string, data: UpdateColumnTemplateDto): Promise<UserColumnTemplate> {
    return this.prisma.userColumnTemplate.update({ where: { id }, data })
  }

  delete(id: string): Promise<UserColumnTemplate> {
    return this.prisma.userColumnTemplate.delete({ where: { id } })
  }
}
