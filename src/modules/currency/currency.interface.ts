import { Currency, Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
    CreateCurrencyDto,
    CurrencyQueryDto,
    ReorderCurrencyDto,
    UpdateCurrencyDto
} from './currency.dto'

type CurrencyBase = Prisma.CurrencyGetPayload<object>
export type CurrencyWithCount = CurrencyBase & { count: number }

export interface ICurrencyRepository {
  create(data: CreateCurrencyDto): Promise<Currency>
  findAll(search?: string): Promise<CurrencyBase[]>
  findAllExcept(id: string, search?: string): Promise<CurrencyBase[]>
  findById(id: string): Promise<CurrencyBase | null>
  findByCode(code: string): Promise<Currency | null>
  update(id: string, data: UpdateCurrencyDto): Promise<Currency>
  delete(id: string): Promise<Currency>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface ICurrencyService {
  create(data: CreateCurrencyDto, user: IUserWithPermissions): Promise<Currency>
  findAll(query: CurrencyQueryDto, user: IUserWithPermissions): Promise<CurrencyWithCount[]>
  findAllExcept(id: string, user: IUserWithPermissions): Promise<CurrencyWithCount[]>
  findOne(id: string, user: IUserWithPermissions): Promise<CurrencyBase>
  update(id: string, data: UpdateCurrencyDto, user: IUserWithPermissions): Promise<Currency>
  remove(id: string, password: string, replacementId: string, user: IUserWithPermissions): Promise<{ message: string }>
  reorder(id: string, data: ReorderCurrencyDto, user: IUserWithPermissions): Promise<{ message: string }>
}
