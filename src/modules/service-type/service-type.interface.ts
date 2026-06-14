import { Prisma, ServiceType } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
    CreateServiceTypeDto,
    ReorderServiceTypeDto,
    UpdateServiceTypeDto
} from './service-type.dto'

type ServiceTypeBase = Prisma.ServiceTypeGetPayload<object>
export type ServiceTypeWithCount = ServiceTypeBase & { count: number }

export interface IServiceTypeRepository {
  create(data: CreateServiceTypeDto): Promise<ServiceType>
  findAll(): Promise<ServiceTypeWithCount[]>
  findAllExcept(id: string): Promise<ServiceTypeWithCount[]>
  findById(id: string): Promise<ServiceTypeBase | null>
  findByType(type: string): Promise<ServiceType | null>
  update(id: string, data: UpdateServiceTypeDto): Promise<ServiceType>
  delete(id: string): Promise<ServiceType>
  countPortfolios(serviceTypeId: string): Promise<number>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IServiceTypeService {
  create(
    data: CreateServiceTypeDto,
    user: IUserWithPermissions
  ): Promise<ServiceType>
  findAll(user: IUserWithPermissions): Promise<ServiceTypeWithCount[]>
  findAllExcept(id: string, user: IUserWithPermissions): Promise<ServiceTypeWithCount[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<ServiceTypeBase>
  update(
    id: string,
    data: UpdateServiceTypeDto,
    user: IUserWithPermissions
  ): Promise<ServiceType>
  remove(id: string, password: string, replacementId: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(
    id: string,
    data: ReorderServiceTypeDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
