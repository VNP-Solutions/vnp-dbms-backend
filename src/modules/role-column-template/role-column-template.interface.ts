import { RoleColumnTemplate } from '@prisma/client'
import { CreateRoleColumnTemplateDto, UpdateRoleColumnTemplateDto } from './role-column-template.dto'

export interface IRoleColumnTemplateRepository {
  create(data: CreateRoleColumnTemplateDto): Promise<RoleColumnTemplate>
  findAll(): Promise<RoleColumnTemplate[]>
  findById(id: string): Promise<RoleColumnTemplate | null>
  findByRoleId(roleId: string): Promise<RoleColumnTemplate[]>
  update(id: string, data: UpdateRoleColumnTemplateDto): Promise<RoleColumnTemplate>
  delete(id: string): Promise<RoleColumnTemplate>
}

export interface IRoleColumnTemplateService {
  create(data: CreateRoleColumnTemplateDto): Promise<RoleColumnTemplate>
  findAll(): Promise<RoleColumnTemplate[]>
  findOne(id: string): Promise<RoleColumnTemplate>
  findByRoleId(roleId: string): Promise<RoleColumnTemplate[]>
  update(id: string, data: UpdateRoleColumnTemplateDto): Promise<RoleColumnTemplate>
  remove(id: string): Promise<{ message: string }>
}
