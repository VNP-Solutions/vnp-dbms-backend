import type { ProjectType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'

export interface IUserProjectRole {
  id: string
  user_id: string
  project_role_id: string
  project_type: ProjectType
  user_role_id: string
  portfolio_ids: string[]
  subportfolio_ids: string[]
  property_ids: string[]
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface IUserProjectRoleWithRelations extends IUserProjectRole {
  user?: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
  user_role?: {
    id: string
    name: string
    description: string
  }
  project_role?: {
    id: string
    name: string
    project_type: ProjectType
  }
}

export interface IUserProjectRoleRepository {
  create(data: any): Promise<IUserProjectRole>
  findById(id: string): Promise<IUserProjectRoleWithRelations | null>
  findByUserId(userId: string): Promise<IUserProjectRoleWithRelations[]>
  findByUserIdAndProject(
    userId: string,
    projectType: ProjectType
  ): Promise<IUserProjectRoleWithRelations | null>
  findAll(
    options?: any,
    include?: any
  ): Promise<IUserProjectRoleWithRelations[]>
  update(id: string, data: any): Promise<IUserProjectRole>
  delete(id: string): Promise<void>
  deleteByUserId(userId: string): Promise<void>
  count(where?: any): Promise<number>
}

export interface IUserProjectRoleService {
  create(
    data: any,
    user: IUserWithPermissions
  ): Promise<IUserProjectRole>
  findAll(user: IUserWithPermissions): Promise<IUserProjectRoleWithRelations[]>
  findByUser(
    userId: string,
    user: IUserWithPermissions
  ): Promise<IUserProjectRoleWithRelations[]>
  findByUserAndProject(
    userId: string,
    projectType: ProjectType,
    user: IUserWithPermissions
  ): Promise<IUserProjectRoleWithRelations | null>
  update(
    id: string,
    data: any,
    user: IUserWithPermissions
  ): Promise<IUserProjectRole>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  assignProjectRole(
    userId: string,
    projectType: ProjectType,
    userRoleId: string,
    resources: {
      portfolio_ids?: string[]
      subportfolio_ids?: string[]
      property_ids?: string[]
    },
    user: IUserWithPermissions
  ): Promise<IUserProjectRole>
  addAccess(
    userProjectRoleId: string,
    data: {
      portfolio_ids?: string[]
      property_ids?: string[]
    },
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  revokeAccess(
    userProjectRoleId: string,
    data: {
      portfolio_ids?: string[]
      property_ids?: string[]
    },
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
