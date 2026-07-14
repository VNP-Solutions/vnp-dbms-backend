import { Inject, Injectable } from '@nestjs/common'
import { RoleColumnTemplate } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRoleColumnTemplateDto, UpdateRoleColumnTemplateDto } from './role-column-template.dto'
import type { IRoleColumnTemplateRepository } from './role-column-template.interface'

@Injectable()
export class RoleColumnTemplateRepository implements IRoleColumnTemplateRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: CreateRoleColumnTemplateDto): Promise<RoleColumnTemplate> {
    return this.prisma.roleColumnTemplate.create({ data })
  }

  findAll(): Promise<RoleColumnTemplate[]> {
    return this.prisma.roleColumnTemplate.findMany({ orderBy: { created_at: 'desc' } })
  }

  findById(id: string): Promise<RoleColumnTemplate | null> {
    return this.prisma.roleColumnTemplate.findUnique({ where: { id } })
  }

  findByRoleId(roleId: string): Promise<RoleColumnTemplate[]> {
    return this.prisma.roleColumnTemplate.findMany({
      where: { role_id: roleId },
      orderBy: { created_at: 'desc' }
    })
  }

  update(id: string, data: UpdateRoleColumnTemplateDto): Promise<RoleColumnTemplate> {
    return this.prisma.roleColumnTemplate.update({ where: { id }, data })
  }

  delete(id: string): Promise<RoleColumnTemplate> {
    return this.prisma.roleColumnTemplate.delete({ where: { id } })
  }
}
