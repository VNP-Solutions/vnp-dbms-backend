/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { BillingType } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateBillingTypeDto, ReorderBillingTypeDto, UpdateBillingTypeDto } from './billing-type.dto'

export type BillingTypeWithCount = BillingType & { count: number }

export interface IBillingTypeRepository {
  create(data: CreateBillingTypeDto): Promise<BillingType>
  findAll(): Promise<BillingTypeWithCount[]>
  findAllExcept(id: string): Promise<BillingTypeWithCount[]>
  findById(id: string): Promise<BillingType | null>
  findByName(name: string): Promise<BillingType | null>
  update(id: string, data: UpdateBillingTypeDto): Promise<BillingType>
  delete(id: string): Promise<BillingType>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IBillingTypeService {
  create(data: CreateBillingTypeDto, user: IUserWithPermissions): Promise<BillingType>
  findAll(user: IUserWithPermissions): Promise<BillingTypeWithCount[]>
  findAllExcept(id: string, user: IUserWithPermissions): Promise<BillingTypeWithCount[]>
  findOne(id: string, user: IUserWithPermissions): Promise<BillingType>
  update(id: string, data: UpdateBillingTypeDto, user: IUserWithPermissions): Promise<BillingType>
  toggle(id: string, user: IUserWithPermissions): Promise<BillingType>
  reorder(id: string, data: ReorderBillingTypeDto, user: IUserWithPermissions): Promise<{ message: string }>
  remove(id: string, password: string, replacementId: string, user: IUserWithPermissions): Promise<{ message: string }>
}
