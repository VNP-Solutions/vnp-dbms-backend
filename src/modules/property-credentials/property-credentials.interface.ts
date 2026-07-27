import type { PropertyCredentials } from '@prisma/client'
import type {
  BulkUpdatePropertyCredentialsDto,
  CreatePropertyCredentialsDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'

export interface IPropertyCredentialsRepository {
  create(data: CreatePropertyCredentialsDto): Promise<PropertyCredentials>
  findAll(): Promise<PropertyCredentials[]>
  findById(id: string): Promise<PropertyCredentials | null>
  findByPropertyId(propertyId: string): Promise<PropertyCredentials | null>
  update(id: string, data: UpdatePropertyCredentialsDto): Promise<PropertyCredentials>
  delete(id: string): Promise<PropertyCredentials>
  bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto
  ): Promise<{ success: PropertyCredentials[]; failed: any[] }>
}

export interface IPropertyCredentialsService {
  create(data: CreatePropertyCredentialsDto): Promise<PropertyCredentials>
  findAll(): Promise<PropertyCredentials[]>
  findOne(id: string): Promise<PropertyCredentials>
  findByPropertyId(propertyId: string): Promise<PropertyCredentials | null>
  findByPropertyIdUnmasked(propertyId: string): Promise<PropertyCredentials>
  update(id: string, data: UpdatePropertyCredentialsDto): Promise<PropertyCredentials>
  remove(id: string): Promise<{ message: string }>
  bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto
  ): Promise<{ success: PropertyCredentials[]; failed: any[]; summary: any }>
}
