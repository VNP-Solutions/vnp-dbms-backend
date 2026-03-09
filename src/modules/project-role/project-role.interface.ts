import type { ProjectType } from '@prisma/client'

export interface IProjectRole {
  id: string
  project_type: ProjectType
  name: string
  description: string | null
  base_user_role_id: string
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface IProjectRoleWithRelations extends IProjectRole {
  base_user_role?: {
    id: string
    name: string
    description: string
  }
  user_project_roles?: Array<{
    id: string
    user_id: string
    user_role_id: string
  }>
}

export interface IProjectRoleRepository {
  create(data: any): Promise<IProjectRole>
  findById(id: string): Promise<IProjectRoleWithRelations | null>
  findManyByProjectType(projectType: ProjectType): Promise<IProjectRole[]>
  findByProjectTypeAndName(
    projectType: ProjectType,
    name: string
  ): Promise<IProjectRole | null>
  findByProjectTypeAndBaseUserRole(
    projectType: ProjectType,
    baseUserRoleId: string
  ): Promise<IProjectRole | null>
  findAll(options?: any, include?: any): Promise<IProjectRoleWithRelations[]>
  update(id: string, data: any): Promise<IProjectRole>
  delete(id: string): Promise<void>
  count(where?: any): Promise<number>
}

export interface IProjectRoleService {
  create(data: any): Promise<IProjectRole>
  findAll(): Promise<IProjectRoleWithRelations[]>
  findOne(id: string): Promise<IProjectRoleWithRelations>
  findManyByProjectType(projectType: ProjectType): Promise<IProjectRole[]>
  findByProjectTypeAndBaseUserRole(
    projectType: ProjectType,
    baseUserRoleId: string
  ): Promise<IProjectRole>
  update(id: string, data: any): Promise<IProjectRole>
  remove(id: string): Promise<{ message: string }>
}
