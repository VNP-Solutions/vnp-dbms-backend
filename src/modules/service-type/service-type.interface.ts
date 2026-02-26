import { Prisma, ServiceType } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
    CreateServiceTypeDto,
    ReorderServiceTypeDto,
    UpdateServiceTypeDto
} from './service-type.dto'

type ServiceTypeWithPortfolios = Prisma.ServiceTypeGetPayload<object>

export interface IServiceTypeRepository {
  create(data: CreateServiceTypeDto): Promise<ServiceType>
  findAll(): Promise<ServiceTypeWithPortfolios[]>
  findById(id: string): Promise<ServiceTypeWithPortfolios | null>
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
  findAll(user: IUserWithPermissions): Promise<ServiceTypeWithPortfolios[]>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<ServiceTypeWithPortfolios>
  update(
    id: string,
    data: UpdateServiceTypeDto,
    user: IUserWithPermissions
  ): Promise<ServiceType>
  remove(id: string, password: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(
    id: string,
    data: ReorderServiceTypeDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
}
