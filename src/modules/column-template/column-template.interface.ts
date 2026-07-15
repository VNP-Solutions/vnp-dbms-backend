import { ColumnTemplate } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'

export interface AuthColumnTemplateResult {
  main_column: string[]
  all_columns: ColumnTemplate[]
}

export interface IColumnTemplateRepository {
  create(data: CreateColumnTemplateDto): Promise<ColumnTemplate>
  findAll(): Promise<ColumnTemplate[]>
  findById(id: string): Promise<ColumnTemplate | null>
  findByUserId(userId: string): Promise<ColumnTemplate[]>
  findByRoleId(roleId: string): Promise<ColumnTemplate[]>
  update(id: string, data: UpdateColumnTemplateDto): Promise<ColumnTemplate>
  delete(id: string): Promise<ColumnTemplate>
}

export interface IColumnTemplateService {
  create(data: CreateColumnTemplateDto): Promise<ColumnTemplate>
  findAll(): Promise<ColumnTemplate[]>
  findOne(id: string): Promise<ColumnTemplate>
  findByUserId(userId: string): Promise<ColumnTemplate[]>
  findByRoleId(roleId: string): Promise<ColumnTemplate[]>
  findByAuth(user: IUserWithPermissions): Promise<AuthColumnTemplateResult>
  update(id: string, data: UpdateColumnTemplateDto): Promise<ColumnTemplate>
  remove(id: string): Promise<{ message: string }>
}
