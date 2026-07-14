import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { RoleColumnTemplate } from '@prisma/client'
import { CreateRoleColumnTemplateDto, UpdateRoleColumnTemplateDto } from './role-column-template.dto'
import type { IRoleColumnTemplateRepository, IRoleColumnTemplateService } from './role-column-template.interface'

@Injectable()
export class RoleColumnTemplateService implements IRoleColumnTemplateService {
  constructor(
    @Inject('IRoleColumnTemplateRepository')
    private readonly repo: IRoleColumnTemplateRepository
  ) {}

  create(data: CreateRoleColumnTemplateDto): Promise<RoleColumnTemplate> {
    return this.repo.create(data)
  }

  findAll(): Promise<RoleColumnTemplate[]> {
    return this.repo.findAll()
  }

  async findOne(id: string): Promise<RoleColumnTemplate> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Role column template not found')
    return item
  }

  async findByRoleId(roleId: string): Promise<RoleColumnTemplate[]> {
    return this.repo.findByRoleId(roleId)
  }

  async update(id: string, data: UpdateRoleColumnTemplateDto): Promise<RoleColumnTemplate> {
    await this.findOne(id)
    return this.repo.update(id, data)
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id)
    await this.repo.delete(id)
    return { message: 'Role column template deleted successfully' }
  }
}
