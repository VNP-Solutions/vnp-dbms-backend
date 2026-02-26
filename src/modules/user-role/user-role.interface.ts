import { Prisma, UserRole } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  CreateUserRoleDto,
  ReorderUserRoleDto,
  UpdateUserRoleDto
} from './user-role.dto'

type UserRoleWithUsers = Prisma.UserRoleGetPayload<object>

export interface IUserRoleRepository {
  create(data: CreateUserRoleDto): Promise<UserRole>
  findAll(): Promise<UserRoleWithUsers[]>
  findById(id: string): Promise<UserRoleWithUsers | null>
  findByName(name: string): Promise<UserRole | null>
  update(id: string, data: UpdateUserRoleDto): Promise<UserRole>
  delete(id: string): Promise<UserRole>
  countUsers(roleId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IUserRoleService {
  create(data: CreateUserRoleDto, user: IUserWithPermissions): Promise<UserRole>
  findAll(user: IUserWithPermissions): Promise<UserRoleWithUsers[]>
  findOne(id: string, user: IUserWithPermissions): Promise<UserRoleWithUsers>
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
