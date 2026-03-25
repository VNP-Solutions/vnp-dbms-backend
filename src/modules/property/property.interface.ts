import { Property } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePropertyDto, PropertyQueryDto, UpdatePropertyDto } from './property.dto'

export type PropertyWithRelations = Property & {
  portfolio: { id: string; name: string }
  subportfolio: { id: string; name: string } | null
}

/**
 * A single typed row fed from the service (after Excel parsing)
 * into the repository's importProperties method.
 */
export interface ImportPropertyRow {
  propertyName: string
  portfolioName?: string
  subPortfolioName?: string
  /** Human-readable Service Type name (e.g. "OTA"). Used when auto-creating a portfolio. */
  serviceTypeName?: string
  isActive?: boolean
  expediaStatus?: string
  bookingStatus?: string
  agodaStatus?: string
  expediaId?: number
  bookingId?: number
  agodaId?: number
  webmailPassword?: string
  // Credentials (passwords should be encrypted before passing here)
  credentials?: {
    expediaUsername?: string
    expediaPassword?: string
    agodaUsername?: string
    agodaPassword?: string
    bookingUsername?: string
    bookingPassword?: string
    expediaEmailAssociated?: string
    propertyContactEmail?: string
    portfolioContactEmail?: string
    multiplePortfolioEmails?: string[]
  }
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
  // Import helpers — all DB access for bulk-import lives in the repository
  findDefaultServiceTypeId(): Promise<string | null>
  findOrCreatePortfolio(name: string, defaultServiceTypeId: string, serviceTypeName?: string): Promise<{ id: string; name: string } | null>
  findOrCreateSubportfolio(name: string, portfolioId: string): Promise<{ id: string; name: string; portfolio_id: string }>
  findFirstPortfolio(): Promise<{ id: string; name: string } | null>
  importProperties(rows: ImportPropertyRow[]): Promise<ImportPropertiesResult>
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
