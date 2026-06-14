/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePriorityDto, ReorderPriorityDto, UpdatePriorityDto } from './priority.dto'

export type PriorityModel = Prisma.PriorityGetPayload<object>
export type PriorityWithCount = PriorityModel & { count: number }

export interface IPriorityRepository {
  create(data: CreatePriorityDto): Promise<PriorityModel>
  findAll(): Promise<PriorityModel[]>
  findAllExcept(id: string): Promise<PriorityModel[]>
  findById(id: string): Promise<PriorityModel | null>
  findByName(name: string): Promise<PriorityModel | null>
  update(id: string, data: UpdatePriorityDto): Promise<PriorityModel>
  delete(id: string): Promise<PriorityModel>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IPriorityService {
  create(data: CreatePriorityDto, user: IUserWithPermissions): Promise<PriorityModel>
  findAll(user: IUserWithPermissions): Promise<PriorityWithCount[]>
  findAllExcept(id: string, user: IUserWithPermissions): Promise<PriorityWithCount[]>
  findOne(id: string, user: IUserWithPermissions): Promise<PriorityModel>
  update(id: string, data: UpdatePriorityDto, user: IUserWithPermissions): Promise<PriorityModel>
  toggle(id: string, user: IUserWithPermissions): Promise<PriorityModel>
  reorder(id: string, data: ReorderPriorityDto, user: IUserWithPermissions): Promise<{ message: string }>
  remove(id: string, password: string, replacementId: string, user: IUserWithPermissions): Promise<{ message: string }>
}
