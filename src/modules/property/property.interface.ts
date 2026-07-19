import { BillingType, Currency, Frequency, Priority, Processor, Property, ServiceType } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type { SyncBulkDeleteResponseDto } from './property.dto'
import { BulkUpdateResultDto, CreatePropertyDto, ExportPropertyExcelDto, PropertyFilterDto, SyncBulkDeleteBodyDto, SyncByOtaDto, UpdatePropertyDto } from './property.dto'

export type PropertyWithRelations = Property & {
  portfolio: { id: string; name: string }
  subportfolio: { id: string; name: string; portfolio_id: string } | null
  currency: Currency | null
  service_type: ServiceType | null
  expedia_service_type: ServiceType | null
  booking_service_type: ServiceType | null
  agoda_service_type: ServiceType | null
  expedia_billing_type: BillingType | null
  booking_billing_type: BillingType | null
  agoda_billing_type: BillingType | null
  expedia_frequency: Frequency | null
  booking_frequency: Frequency | null
  agoda_frequency: Frequency | null
  expedia_processor: Processor | null
  booking_processor: Processor | null
  agoda_processor: Processor | null
  expedia_priority: Priority | null
  booking_priority: Priority | null
  agoda_priority: Priority | null
  total_notes: number
}

export interface ImportPropertyRow {
  propertyName: string
  portfolioName: string
  propertyAddress?: string
  cardDescriptor?: string
  description?: string
  propertyIdentifier?: string
  portfolioContact?: string
  expediaId?: string
  agodaId?: string
  bookingId?: string
  expediaUsername?: string
  agodaUsername?: string
  bookingUsername?: string
  expediaPassword?: string
  bookingPassword?: string
  agodaPassword?: string
  expediaSecondaryUsername?: string
  expediaSecondaryPassword?: string
  bookingSecondaryUsername?: string
  bookingSecondaryPassword?: string
  agodaSecondaryUsername?: string
  agodaSecondaryPassword?: string
  portfolioContactEmail?: string
  caseContactEmail?: string
  qpUsername?: string
  qpPassword?: string
  qpApiKey?: string
  fpUsername?: string
  fpPassword?: string
  newDomainsEmail?: string
  webmailPassword?: string
  expediaStatus?: string
  bookingStatus?: string
  agodaStatus?: string
  caseManagementContact?: string
  accessContact?: string
  reportingContact?: string
  expediaProcessor?: string
  bookingProcessor?: string
  agodaProcessor?: string
  fpMid?: string
  stripeAccountEmail?: string
  expediaBillingType?: string
  expediaServiceType?: string
  expediaFrequency?: string
  expediaAccessLevel?: string
  expediaFrom?: string
  expediaTo?: string
  expediaScheduler?: string
  expediaDuration?: string
  bookingBillingType?: string
  bookingServiceType?: string
  bookingFrequency?: string
  bookingAccessLevel?: string
  bookingFrom?: string
  bookingTo?: string
  bookingScheduler?: string
  bookingDuration?: string
  agodaBillingType?: string
  agodaServiceType?: string
  agodaFrequency?: string
  agodaAccessLevel?: string
  agodaFrom?: string
  agodaTo?: string
  agodaScheduler?: string
  agodaDuration?: string
  needAnotherDomain?: string
  bookingOtpPhone?: string
  serviceTypeName?: string
  currency?: string
  // New Expedia fields
  expediaServiceFee?: string
  expediaPriority?: string
  expediaCrs?: string
  expediaCrsDb?: string
  expediaRunDateFrom?: string
  expediaRunDateTo?: string
  expediaRunDateDbFrom?: string
  expediaRunDateDbTo?: string
  expediaRevisedDate?: string
  expediaSchedulerReviewFrom?: string
  expediaSchedulerReviewTo?: string
  expediaSchedulerDb?: string
  expediaSchedulerReviewDbFrom?: string
  expediaSchedulerReviewDbTo?: string
  expediaDbDuration?: string
  expediaCredentialVerified?: string
  expediaOtpNumber?: string
  fromDb?: string
  toDb?: string
  // New Booking fields
  bookingServiceFee?: string
  bookingPriority?: string
  bookingCrs?: string
  bookingRunDate?: string
  bookingRevisedDate?: string
  bookingCredentialVerified?: string
  bookingOtpNumber?: string
  // New Agoda fields
  agodaServiceFee?: string
  agodaPriority?: string
  agodaCrs?: string
  agodaRunDate?: string
  agodaRevisedDate?: string
  agodaCredentialVerified?: string
  agodaOtpNumber?: string
  // Misc new fields
  salesRep?: string
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
  portfolio_id: string[]
  subportfolio: Array<{ id: string; name: string; portfolio_id: string }>
  booking_id: string[]
  agoda_id: string[]
  hotel_address: string[]
  card_descriptor: string[]
  new_domain_email: string[]
  portfolio_contact_email: string[]
  case_contact_email: string[]
  case_management_contact: string[]
  access_contact: string[]
  reporting_contact: string[]
  description: string[]
  expedia_status: string[]
  booking_status: string[]
  agoda_status: string[]
  expedia_processor: Processor[]
  booking_processor: Processor[]
  agoda_processor: Processor[]
  fp_mid: string[]
  stripe_account_email: string[]
  from: string[]
  to: string[]
  property_identifier: string[]
  portfolio_contact: string[]
  service_type: ServiceType[]
  currency: Currency[]
  fp_username: string[]
  qp_username: string[]
  previous_portfolio_id: string[]
  next_due_date: string[]
  expedia_billing_type: BillingType[]
  expedia_service_type: ServiceType[]
  expedia_frequency: Frequency[]
  expedia_from: string[]
  expedia_to: string[]
  expedia_duration: string[]
  expedia_access_level: string[]
  expedia_scheduler: string[]
  booking_billing_type: BillingType[]
  booking_service_type: ServiceType[]
  booking_frequency: Frequency[]
  booking_from: string[]
  booking_to: string[]
  booking_duration: string[]
  booking_access_level: string[]
  booking_scheduler: string[]
  agoda_billing_type: BillingType[]
  agoda_service_type: ServiceType[]
  agoda_frequency: Frequency[]
  agoda_from: string[]
  agoda_to: string[]
  agoda_duration: string[]
  agoda_access_level: string[]
  agoda_scheduler: string[]
  need_another_domain: string[]
  booking_otp_phone: string[]
  expedia_secondary_username: string[]
  booking_secondary_username: string[]
  agoda_secondary_username: string[]
  expedia_service_fee: string[]
  expedia_priority: Priority[]
  from_db: string[]
  to_db: string[]
  expedia_revised_date: { min: string | null; max: string | null }
  expedia_scheduler_review_from: string[]
  expedia_scheduler_review_to: string[]
  expedia_scheduler_review_db_from: string[]
  expedia_scheduler_review_db_to: string[]
  expedia_scheduler_db: string[]
  expedia_crs: string[]
  expedia_crs_db: string[]
  expedia_run_date_from: string[]
  expedia_run_date_to: string[]
  expedia_run_date_db_from: string[]
  expedia_run_date_db_to: string[]
  expedia_db_duration: string[]
  expedia_credential_verified: string[]
  expedia_otp_number: string[]
  booking_service_fee: string[]
  booking_priority: Priority[]
  booking_crs: string[]
  booking_run_date: string[]
  booking_revised_date: string[]
  booking_credential_verified: string[]
  booking_otp_number: string[]
  agoda_service_fee: string[]
  agoda_priority: Priority[]
  agoda_crs: string[]
  agoda_run_date: string[]
  agoda_revised_date: string[]
  agoda_credential_verified: string[]
  agoda_otp_number: string[]
  sales_rep: string[]
  discontinued_email_ids: string[]
  cybersource_mid: string[]
  adyen_location: string[]
  stripe_connected_email: string[]
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
  findIdsByOtaIds(ota: { expedia_id?: number | null; booking_id?: number | null; agoda_id?: number | null }): Promise<string[]>;
}

export type PropertyContact = {
  // Property-level contacts
  portfolio_contact: string | null
  portfolio_contact_email: string | null
  case_management_contact: string | null
  access_contact: string | null
  reporting_contact: string | null
  primary_case_email: string | null
  others_case_emails: string[]
  new_domain_email: string | null
  // Credential-level contacts
  property_contact_email: string | null
  portfolio_contact_email_cred: string | null
  multiple_portfolio_emails: string[]
  case_contact_email: string | null
  case_contact_name: string | null
  case_contact_phone: string | null
  reporting_contact_name: string | null
  reporting_contact_email: string | null
  reporting_contact_phone: string | null
}

export interface IPropertyService {
  create(data: CreatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  createAndSync(data: CreatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  findAllWithFilters(filterDto: PropertyFilterDto, user: IUserWithPermissions): Promise<PaginatedResult<PropertyWithRelations>>
  findAllCached(user: IUserWithPermissions): Promise<PropertyWithRelations[]>
  refreshCache(user: IUserWithPermissions): Promise<{ message: string }>
  findOne(id: string, user: IUserWithPermissions): Promise<PropertyWithRelations>
  update(id: string, data: UpdatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  updateAndSync(id: string, data: UpdatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations>
  syncBulkDelete(body: SyncBulkDeleteBodyDto): Promise<SyncBulkDeleteResponseDto>
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
  bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto>
  getAllDataForGlobalFilter(user: IUserWithPermissions): Promise<AllDataForGlobalFilterResponse>
  exportToExcelAndEmail(dto: ExportPropertyExcelDto, user: IUserWithPermissions): Promise<{ message: string }>
  transferPortfolio(id: string, portfolioId: string, password: string, user: IUserWithPermissions): Promise<PropertyWithRelations>
  syncByOta(dto: SyncByOtaDto): Promise<{ status: string; id?: string; candidates?: string[] }>
  bulkTransferPortfolio(ids: string[], portfolioId: string, password: string, user: IUserWithPermissions): Promise<BulkTransferResult>
  importFromExcelAndSync(file: Express.Multer.File, user: IUserWithPermissions): Promise<ImportPropertiesResult>
  removeAndSync(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  getContact(id: string, user: IUserWithPermissions): Promise<PropertyContact>
  getContactExternal(id: string): Promise<PropertyContact>
}

export interface BulkTransferResult {
  success: Array<{ id: string; name: string }>
  skipped: Array<{ id: string; name?: string; reason: string }>
  successCount: number
  skippedCount: number
}

export interface ImportPropertiesResult {
  propertiesCreated: number
  credentialsCreated: number
  propertiesSkipped: number
  properties: any[]
  existingProperties?: any[]   // existed on DBMS — still attempt parser sync
  skippedProperties: Array<{ name: string; reason: string }>
}