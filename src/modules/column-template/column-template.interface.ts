import { UserColumnTemplate } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'

export interface AuthColumnTemplateResult {
  main_column: string[]
  all_columns: UserColumnTemplate[]
}

export interface IColumnTemplateRepository {
  create(data: CreateColumnTemplateDto): Promise<UserColumnTemplate>
  findAll(): Promise<UserColumnTemplate[]>
  findById(id: string): Promise<UserColumnTemplate | null>
  findByUserId(userId: string): Promise<UserColumnTemplate[]>
  update(id: string, data: UpdateColumnTemplateDto): Promise<UserColumnTemplate>
  delete(id: string): Promise<UserColumnTemplate>
}

export interface IColumnTemplateService {
  create(data: CreateColumnTemplateDto): Promise<UserColumnTemplate>
  findAll(): Promise<UserColumnTemplate[]>
  findOne(id: string): Promise<UserColumnTemplate>
  findByUserId(userId: string): Promise<UserColumnTemplate[]>
  findByAuth(user: IUserWithPermissions): Promise<AuthColumnTemplateResult>
  update(id: string, data: UpdateColumnTemplateDto): Promise<UserColumnTemplate>
  remove(id: string): Promise<{ message: string }>
}
