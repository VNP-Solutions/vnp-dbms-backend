import { Prisma, UserRole } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateUserRoleDto,
  ReorderUserRoleDto,
  UpdateUserRoleDto
} from './user-role.dto'

export type UserRoleWithUserCount = UserRole & { user_count: number }

type UserRoleUserSummary = Prisma.UserGetPayload<{
  select: {
    id: true
    first_name: true
    last_name: true
    email: true
    is_verified: true
  }
}>

export type UserRoleDetail = UserRoleWithUserCount & {
  users: UserRoleUserSummary[]
}

export interface IUserRoleRepository {
  create(data: CreateUserRoleDto): Promise<UserRole>
  findAll(): Promise<UserRoleWithUserCount[]>
  findById(id: string): Promise<UserRoleDetail | null>
  findByName(name: string): Promise<UserRole | null>
  update(id: string, data: UpdateUserRoleDto): Promise<UserRole>
  delete(id: string): Promise<UserRole>
  countUsers(roleId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IUserRoleService {
  create(data: CreateUserRoleDto, user: IUserWithPermissions): Promise<UserRole>
  findAll(user: IUserWithPermissions): Promise<UserRoleWithUserCount[]>
  findOne(id: string, user: IUserWithPermissions): Promise<UserRoleDetail>
  update(
    id: string,
    data: UpdateUserRoleDto,
    user: IUserWithPermissions
  ): Promise<UserRole>
  remove(id: string, password: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(
    id: string,
    data: ReorderUserRoleDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
