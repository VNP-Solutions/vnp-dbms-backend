/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import { Prisma } from '@prisma/client'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateProcessorDto, ReorderProcessorDto, UpdateProcessorDto } from './processor.dto'

export type ProcessorModel = Prisma.ProcessorGetPayload<object>

export interface IProcessorRepository {
  create(data: CreateProcessorDto): Promise<ProcessorModel>
  findAll(): Promise<ProcessorModel[]>
  findById(id: string): Promise<ProcessorModel | null>
  findByName(name: string): Promise<ProcessorModel | null>
  update(id: string, data: UpdateProcessorDto): Promise<ProcessorModel>
  delete(id: string): Promise<ProcessorModel>
  count(): Promise<number>
  updateMany(data: Array<{ id: string; order: number }>): Promise<void>
}

export interface IProcessorService {
  create(data: CreateProcessorDto, user: IUserWithPermissions): Promise<ProcessorModel>
  findAll(user: IUserWithPermissions): Promise<ProcessorModel[]>
  findOne(id: string, user: IUserWithPermissions): Promise<ProcessorModel>
  update(id: string, data: UpdateProcessorDto, user: IUserWithPermissions): Promise<ProcessorModel>
  toggle(id: string, user: IUserWithPermissions): Promise<ProcessorModel>
  reorder(id: string, data: ReorderProcessorDto, user: IUserWithPermissions): Promise<{ message: string }>
  remove(id: string, password: string, user: IUserWithPermissions): Promise<{ message: string }>
}
