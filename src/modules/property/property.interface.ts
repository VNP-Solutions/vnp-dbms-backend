import { Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePropertyDto, PropertyFilterDto, UpdatePropertyDto } from './property.dto'

export type PropertyWithRelations = Property & {
  portfolio: { id: string; name: string }
  subportfolio: { id: string; name: string } | null
}

export interface ImportPropertyRow {
  propertyName: string
  portfolioName: string
  propertyAddress?: string
  cardDescriptor?: string
  expediaId?: string
  agodaId?: string
  bookingId?: string
  expediaUsername?: string
  agodaUsername?: string
  bookingUsername?: string
  expediaPassword?: string
  bookingPassword?: string
  agodaPassword?: string
  portfolioContactEmail?: string
  caseContactEmail?: string
  qpUsername?: string
  qpPassword?: string
  qpApiKey?: string
  newDomainsEmail?: string
  webmailPassword?: string
}

export interface ImportPropertiesResult {
  propertiesCreated: number
  credentialsCreated: number
  propertiesSkipped: number
  properties: any[]
  skippedProperties: Array<{ name: string; reason: string }>
}

export interface GetPropertyCredentialResult {
  credential: Record<string, string>
}

export interface BulkDeleteResult {
  success: Array<{ id: string; name: string }>
  skipped: Array<{ id: string; name?: string; reason: string }>
  totalProcessed: number
  successCount: number
  skippedCount: number
}

export interface AllDataForGlobalFilterResponse {
  expedia_id: string[]
  portfolio: Array<{ id: string; name: string }>
  property: Array<{ id: string; name: string }>
  booking_id: string[]
  agoda_id: string[]
  hotel_address: string[]
  card_descriptor: string[]
  new_domain_email: string[]
  portfolio_contact_email: string[]
  case_contact_email: string[]
}

export interface IPropertyRepository {
  create(data: CreatePropertyDto): Promise<PropertyWithRelations>
  findAll(queryOptions: { where: any; skip?: number; take?: number; orderBy?: any }): Promise<PropertyWithRelations[]>
  count(where: any): Promise<number>
  findById(id: string): Promise<PropertyWithRelations | null>
  findByName(name: string): Promise<Property | null>
  update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations>
  delete(id: string): Promise<Property>
  bulkDelete(ids: string[]): Promise<BulkDeleteResult>
  findByPortfolioId(portfolioId: string): Promise<PropertyWithRelations[]>
  findBySubportfolioId(subportfolioId: string): Promise<PropertyWithRelations[]>
  getAccessiblePropertyIds(userId: string): Promise<string[] | 'all'>
  getDropdownPortfoliosAndSubportfolios(userId: string): Promise<{
    portfolios: { id: string; name: string }[]
    subportfolios: { id: string; name: string; portfolio_id: string }[]
  }>
  importProperties(rows: ImportPropertyRow[]): Promise<ImportPropertiesResult>
}

export interface IPropertyService {
  create(data: CreatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  findAllWithFilters(filterDto: PropertyFilterDto, user: IUserWithPermissions): Promise<PaginatedResult<PropertyWithRelations>>
  findAllCached(user: IUserWithPermissions): Promise<PropertyWithRelations[]>
  findOne(id: string, user: IUserWithPermissions): Promise<PropertyWithRelations>
  update(id: string, data: UpdatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  bulkDelete(ids: string[], user: IUserWithPermissions): Promise<BulkDeleteResult>
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
  getAllDataForGlobalFilter(user: IUserWithPermissions): Promise<AllDataForGlobalFilterResponse>
}
