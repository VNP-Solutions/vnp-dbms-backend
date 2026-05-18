import { Prisma, User } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AssignUserRoleDto,
  DeleteUserDto,
  ManageUserAccessDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
  UserQueryDto
} from './user.dto'

export type InvitedByUser = {
  id: string
  first_name: string
  last_name: string
  email: string
}

export type UserWithRole = Prisma.UserGetPayload<{
  select: {
    id: true
    first_name: true
    last_name: true
    email: true
    language: true
    user_role_id: true
    is_verified: true
    display_image: true
    contact_number: true
    job_title: true
    phone_number: true
    created_at: true
    updated_at: true
    invited_by_id: true
    invitation_sent_at: true
    role: {
      select: {
        id: true
        name: true
        description: true
        is_external: true
        can_access_mis: true
        portfolio_permission: true
        property_permission: true
        audit_permission: true
        user_permission: true
        system_settings_permission: true
        bank_details_permission: true
        roles_permission: true
        access_logs_permission: true
      }
    }
    invitedBy: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
      }
    }
  }
}>

export type UserWithDetails = Prisma.UserGetPayload<{
  select: {
    id: true
    first_name: true
    last_name: true
    email: true
    language: true
    user_role_id: true
    is_verified: true
    display_image: true
    contact_number: true
    job_title: true
    phone_number: true
    created_at: true
    updated_at: true
    invited_by_id: true
    invitation_sent_at: true
    role: {
      select: {
        id: true
        name: true
        description: true
        is_external: true
        can_access_mis: true
        portfolio_permission: true
        property_permission: true
        audit_permission: true
        user_permission: true
        system_settings_permission: true
        bank_details_permission: true
        roles_permission: true
        access_logs_permission: true
      }
    }
    invitedBy: {
      select: {
        id: true
        first_name: true
        last_name: true
        email: true
      }
    }
    userAccessedProperties: {
      select: {
        property_id: true
        portfolio_id: true
      }
    }
    userProjectRoles: {
      select: {
        id: true
        project_type: true
      }
    }
  }
}>

export type UserWithAccessedProperties = UserWithDetails & {
  userAccessProperties: {
    portfolios: Array<{
      id: string
      name: string
      service_type: string
    }>
    properties: Array<{
      id: string
      name: string
      portfolio: {
        id: string
        name: string
      }
    }>
    userProjectRoles: Array<{
      id: string
      properties: Array<{
        id: string
        name: string
        portfolio: {
          id: string
          name: string
        }
      }>
      portfolios: Array<{
        id: string
        name: string
        service_type: string
      }>
    }>
  }
}

export interface IUserRepository {
  findAll(queryOptions: any, userIds?: string[]): Promise<UserWithRole[]>
  count(whereClause: any, userIds?: string[]): Promise<number>
  findById(id: string): Promise<UserWithDetails | null>
  findUserWithAccessibleResources(id: string): Promise<{
    user: UserWithDetails
    properties: Array<{
      id: string
      name: string
      portfolio: {
        id: string
        name: string
      }
    }>
    portfolios: Array<{
      id: string
      name: string
      service_type: string
    }>
    userProjectRoles: Array<{
      id: string
      properties: Array<{
        id: string
        name: string
        portfolio: {
          id: string
          name: string
        }
      }>
      portfolios: Array<{
        id: string
        name: string
        service_type: string
      }>
    }>
  } | null>
  update(id: string, data: Partial<User>): Promise<UserWithRole>
  updateRole(id: string, roleId: string): Promise<UserWithRole>
  delete(id: string): Promise<User>
  findRoleById(roleId: string): Promise<any>
  addUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
  revokeUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void>
}

export interface IUserService {
  findAll(
    query: UserQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<UserWithRole>>
  getProfile(userId: string): Promise<UserWithDetails>
  updateProfile(
    userId: string,
    data: UpdateOwnProfileDto
  ): Promise<UserWithRole>
  findOne(id: string, user: IUserWithPermissions): Promise<UserWithAccessedProperties>
  update(
    id: string,
    data: UpdateUserDto,
    user: IUserWithPermissions
  ): Promise<UserWithRole>
  updateRole(
    id: string,
    data: AssignUserRoleDto,
    user: IUserWithPermissions
  ): Promise<UserWithRole>
  remove(
    id: string,
    data: DeleteUserDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  addAccess(
    id: string,
    data: ManageUserAccessDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  revokeAccess(
    id: string,
    data: ManageUserAccessDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
