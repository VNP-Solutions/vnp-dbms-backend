import { Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePropertyDto, PropertyQueryDto, UpdatePropertyDto } from './property.dto'

export type PropertyWithRelations = Property & {
  portfolio: { id: string; name: string }
  subportfolio: { id: string; name: string } | null
  currency: { id: string; code: string; name: string } | null
}

export interface IPropertyRepository {
  create(data: CreatePropertyDto): Promise<PropertyWithRelations>
  findAll(queryOptions: { where: any; skip?: number; take?: number; orderBy?: any }): Promise<PropertyWithRelations[]>
  count(where: any): Promise<number>
  findById(id: string): Promise<PropertyWithRelations | null>
  findByName(name: string): Promise<Property | null>
  update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations>
  delete(id: string): Promise<Property>
  findByPortfolioId(portfolioId: string): Promise<PropertyWithRelations[]>
  findBySubportfolioId(subportfolioId: string): Promise<PropertyWithRelations[]>
  getAccessiblePropertyIds(userId: string): Promise<string[] | 'all'>
  getDropdownPortfoliosAndSubportfolios(userId: string): Promise<{
    portfolios: { id: string; name: string }[]
    subportfolios: { id: string; name: string; portfolio_id: string }[]
  }>
}

export interface ImportPropertiesResult {
  portfoliosCreated: number
  subportfoliosCreated: number
  propertiesCreated: number
  credentialsCreated: number
  portfolios: any[]
  subportfolios: any[]
  properties: any[]
}

export interface GetPropertyCredentialResult {
  credential: Record<string, string>
}

export interface IPropertyService {
  create(data: CreatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  findAll(query: PropertyQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<PropertyWithRelations>>
  findOne(id: string, user: IUserWithPermissions): Promise<PropertyWithRelations>
  update(id: string, data: UpdatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  findByPortfolioId(portfolioId: string, user: IUserWithPermissions): Promise<PropertyWithRelations[]>
  findBySubportfolioId(subportfolioId: string, user: IUserWithPermissions): Promise<PropertyWithRelations[]>
  getDropdown(user: IUserWithPermissions): Promise<{
    portfolios: { id: string; name: string }[]
    subportfolios: { id: string; name: string; portfolio_id: string }[]
  }>
  getPropertyCredential(dto: {
    email: string
    password: string
    required_field: string
    property_id: string
  }): Promise<GetPropertyCredentialResult>
  importFromExcel(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPropertiesResult>
}
