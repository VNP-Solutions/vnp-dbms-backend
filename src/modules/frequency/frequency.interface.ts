/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateFrequencyDto, ReorderFrequencyDto, UpdateFrequencyDto } from './frequency.dto'

export type FrequencyModel = Prisma.FrequencyGetPayload<object>
export type FrequencyWithCount = FrequencyModel & { count: number }

export interface IFrequencyRepository {
  create(data: CreateFrequencyDto): Promise<FrequencyModel>
  findAll(): Promise<FrequencyWithCount[]>
  findAllExcept(id: string): Promise<FrequencyWithCount[]>
  findById(id: string): Promise<FrequencyModel | null>
  findByName(name: string): Promise<FrequencyModel | null>
  update(id: string, data: UpdateFrequencyDto): Promise<FrequencyModel>
  delete(id: string): Promise<FrequencyModel>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IFrequencyService {
  create(data: CreateFrequencyDto, user: IUserWithPermissions): Promise<FrequencyModel>
  findAll(user: IUserWithPermissions): Promise<FrequencyWithCount[]>
  findAllExcept(id: string, user: IUserWithPermissions): Promise<FrequencyWithCount[]>
  findOne(id: string, user: IUserWithPermissions): Promise<FrequencyModel>
  update(id: string, data: UpdateFrequencyDto, user: IUserWithPermissions): Promise<FrequencyModel>
  toggle(id: string, user: IUserWithPermissions): Promise<FrequencyModel>
  reorder(id: string, data: ReorderFrequencyDto, user: IUserWithPermissions): Promise<{ message: string }>
  remove(id: string, password: string, replacementId: string, user: IUserWithPermissions): Promise<{ message: string }>
}
