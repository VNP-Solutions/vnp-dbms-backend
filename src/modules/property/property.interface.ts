import {
  BillingType,
  Currency,
  Frequency,
  Note,
  Priority,
  Processor,
  Property,
  ServiceType
} from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type {
  SyncBulkDeleteResponseDto,
  UploadJobAcceptedDto
} from './property.dto'
import {
  CreatePropertyDto,
  ExportPropertyExcelDto,
  PropertyFilterDto,
  SyncBulkDeleteBodyDto,
  SyncByOtaDto,
  UpdatePropertyDto
} from './property.dto'

/** Per-system entity state shown to the frontend while an upload job runs. */
export type EntitySyncState =
  | 'pending'
  | 'processing'
  | 'created'
  | 'updated'
  | 'skipped'
  | 'failed'

export interface EntitySyncStatus {
  state: EntitySyncState
  reason?: string
}

/** One portfolio or property row tracked within an upload job. */
export interface UploadJobEntity {
  /** Excel row number (1-based, header excluded) — null when not tied to a single row (e.g. a portfolio referenced by several rows). */
  row: number | null
  /** DBMS id of the entity, when the job started from ids rather than a file
   *  (bulk-transfer) — lets the frontend map progress back to the rows the
   *  user selected. Absent for file-driven jobs, where `row` identifies it. */
  id?: string
  name: string
  /** Snapshotted portfolio name for property rows (import / update / transfer source). */
  portfolioName?: string
  /** DBMS portfolio id for property rows (source portfolio; before transfer for bulk-transfer). */
  portfolioId?: string
  dbms: EntitySyncStatus
  scraper: EntitySyncStatus
  dashboard: EntitySyncStatus
}

export type UploadJobStatus =
  | 'pending'
  | 'processing_portfolios'
  | 'processing_properties'
  | 'complete'
  | 'failed'

/** Live status document for a bulk import / bulk-update background job, persisted in Redis. */
export interface UploadJobData {
  jobId: string
  source: 'import' | 'bulk-update' | 'bulk-transfer'
  /** Name of the uploaded file. For `bulk-transfer` — which has no file —
   *  this carries the target portfolio name instead, so the same status
   *  document and report email stay renderable for every job source. */
  filename: string
  /** DBMS target portfolio id for `bulk-transfer` jobs. */
  targetPortfolioId?: string
  userId: string
  userEmail: string
  /** Snapshotted display name for durable action logs / report emails. */
  userName?: string
  /** Snapshotted role name for durable action logs. */
  userRole?: string
  status: UploadJobStatus
  error?: string
  /** `processed` = how many items have reached a terminal state (created/updated/skipped/failed)
   *  across DBMS + scraper + dashboard — use with `total` to render a progress bar.
   *  `total` is 0 until the file has been parsed (before that, there's nothing to show yet). */
  portfolios: { total: number; processed: number; items: UploadJobEntity[] }
  properties: { total: number; processed: number; items: UploadJobEntity[] }
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type PropertyWithRelations = Property & {
  portfolio: { id: string; name: string }
  subportfolio: { id: string; name: string; portfolio_id: string | null } | null
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
  priority: Priority | null
  total_notes: number
  notes: Pick<
    Note,
    'id' | 'text' | 'is_done' | 'user_id' | 'created_at' | 'updated_at'
  >[]
}

export interface ImportPropertyRow {
  propertyName: string
  portfolioName: string
  subportfolioName?: string
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
  expediaCrs?: string
  expediaCrsDb?: string
  expediaRunDate?: string
  expediaRunDateDb?: string
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
  bookingCrs?: string
  bookingRunDate?: string
  bookingRevisedDate?: string
  bookingCredentialVerified?: string
  bookingOtpNumber?: string
  // New Agoda fields
  agodaServiceFee?: string
  agodaCrs?: string
  agodaRunDate?: string
  agodaRevisedDate?: string
  agodaCredentialVerified?: string
  agodaOtpNumber?: string
  // Misc new fields
  isActive?: string
  nextDueDate?: string
  priority?: string
  expediaPriority?: string
  bookingPriority?: string
  agodaPriority?: string
  salesRep?: string
  discontinuedEmailIds?: string // comma-separated in Excel, stored as array
  cybersourceMid?: string
  adyenLocation?: string
  stripeConnectedEmail?: string
  notes?: string // semicolon-separated note texts in Excel, each becomes a Note record
}

export interface ImportPropertiesResult {
  propertiesCreated: number
  credentialsCreated: number
  propertiesSkipped: number
  properties: any[]
  skippedProperties: Array<{ name: string; reason: string }>
  /** Portfolios auto-created during import (for dashboard/scraper sync). */
  createdPortfolios?: Array<{ id: string; name: string }>
  /** Subportfolios auto-created during import (for scraper sync). */
  createdSubportfolios?: Array<{
    id: string
    name: string
    portfolio_id: string
  }>
  /**
   * Columns the imported rows cleared with a NULL cell. The scraper/dashboard
   * payloads repeat these as the string "NULL", since an omitted key reads as
   * "unchanged" downstream.
   */
  nulledFields?: string[]
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
  priority: Priority[]
  expedia_priority: string[]
  booking_priority: string[]
  agoda_priority: string[]
  from_db: string[]
  to_db: string[]
  expedia_revised_date: string[]
  expedia_scheduler_review_from: string[]
  expedia_scheduler_review_to: string[]
  expedia_scheduler_review_db_from: string[]
  expedia_scheduler_review_db_to: string[]
  expedia_scheduler_db: string[]
  expedia_crs: string[]
  expedia_crs_db: string[]
  expedia_run_date: string[]
  expedia_run_date_db: string[]
  expedia_db_duration: string[]
  expedia_credential_verified: string[]
  expedia_otp_number: string[]
  booking_service_fee: string[]
  booking_crs: string[]
  booking_run_date: string[]
  booking_revised_date: string[]
  booking_credential_verified: string[]
  booking_otp_number: string[]
  agoda_service_fee: string[]
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
  user_name_expedia: string[]
  user_name_booking: string[]
  user_name_agoda: string[]
}

export interface IPropertyRepository {
  create(data: CreatePropertyDto): Promise<PropertyWithRelations>
  findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PropertyWithRelations[]>
  count(where: any): Promise<number>
  findIds(where: any, orderBy?: any): Promise<string[]>
  findById(id: string): Promise<PropertyWithRelations | null>
  findByIds(ids: string[]): Promise<PropertyWithRelations[]>
  findByPropertyIdentifier(identifier: string): Promise<Property | null>
  update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations>
  delete(id: string): Promise<Property>
  bulkDelete(ids: string[]): Promise<BulkDeleteResult>
  findByPortfolioId(portfolioId: string): Promise<PropertyWithRelations[]>
  findBySubportfolioId(subportfolioId: string): Promise<PropertyWithRelations[]>
  getAccessiblePropertyIds(userId: string): Promise<string[] | 'all'>
  getDropdownPortfoliosAndSubportfolios(userId: string): Promise<{
    portfolios: { id: string; name: string }[]
    subportfolios: { id: string; name: string; portfolio_id: string | null }[]
  }>
  importProperties(
    rows: ImportPropertyRow[],
    userId?: string
  ): Promise<ImportPropertiesResult>
  resolveOrCreatePortfolio(
    portfolioName: string
  ): Promise<{ id: string; name: string; created: boolean } | { error: string }>
  resolveOrCreateSubportfolio(
    subName: string,
    portfolioId?: string
  ): Promise<{ id: string; created: boolean } | { error: string }>
  findIdsByOtaIds(ota: {
    expedia_id?: number | null
    booking_id?: number | null
    agoda_id?: number | null
  }): Promise<string[]>
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
  create(
    data: CreatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  createAndSync(
    data: CreatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  findAllWithFilters(
    filterDto: PropertyFilterDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyWithRelations>>
  findAllCached(user: IUserWithPermissions): Promise<PropertyWithRelations[]>
  refreshCache(user: IUserWithPermissions): Promise<{ message: string }>
  findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  update(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  updateAndSync(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations>
  syncBulkDelete(
    body: SyncBulkDeleteBodyDto
  ): Promise<SyncBulkDeleteResponseDto>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  bulkDelete(
    ids: string[],
    user: IUserWithPermissions
  ): Promise<BulkDeleteResult>
  findByPortfolioId(
    portfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]>
  findBySubportfolioId(
    subportfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]>
  getDropdown(user: IUserWithPermissions): Promise<{
    portfolios: { id: string; name: string }[]
    subportfolios: { id: string; name: string; portfolio_id: string | null }[]
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
  ): Promise<UploadJobAcceptedDto>
  getAllDataForGlobalFilter(
    user: IUserWithPermissions
  ): Promise<AllDataForGlobalFilterResponse>
  exportToExcelAndEmail(
    dto: ExportPropertyExcelDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  transferPortfolio(
    id: string,
    portfolioId: string,
    password: string,
    user: IUserWithPermissions
  ): Promise<TransferPortfolioResult>
  syncByOta(
    dto: SyncByOtaDto
  ): Promise<{ status: string; id?: string; candidates?: string[] }>
  /// Accepted-and-backgrounded, like `bulkUpdate`: the DBMS moves and the
  /// downstream sync-upserts run off-request, tracked as an upload job.
  bulkTransferPortfolio(
    ids: string[],
    portfolioId: string,
    password: string,
    user: IUserWithPermissions
  ): Promise<UploadJobAcceptedDto>
  importFromExcelAndSync(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<UploadJobAcceptedDto>
  /// Query the live status of a background upload job (for FE polling).
  getUploadJobStatus(jobId: string): Promise<UploadJobData | undefined>
  /// Query the most recent upload job started by this user (for page refresh).
  getLatestUploadJobForUser(userId: string): Promise<UploadJobData | undefined>
  removeAndSync(
    id: string,
    user: IUserWithPermissions
  ): Promise<{
    message: string
    /// Per-platform outcome of the delete fan-out. Absent only when the row
    /// disappeared before the fan-out could run.
    sync?: {
      dashboard: { success: boolean; reason?: string }
      scraper: { success: boolean; reason?: string }
    }
  }>
  getContact(id: string, user: IUserWithPermissions): Promise<PropertyContact>
  getContactExternal(id: string): Promise<PropertyContact>
}

/// Per-platform outcome of a property sync-upsert fan-out. A DBMS write can
/// succeed while one or both downstream platforms reject or miss the change.
export interface PropertySyncOutcome {
  dashboard: { success: boolean; reason?: string }
  scraper: { success: boolean; reason?: string }
}

/// The transferred property, plus the outcome of pushing its new portfolio to
/// the dashboard and the scraper. A 200 means the DBMS move succeeded —
/// inspect `sync` to see whether each platform also applied it.
export type TransferPortfolioResult = PropertyWithRelations & {
  sync: PropertySyncOutcome
}

export interface ImportPropertiesResult {
  propertiesCreated: number
  credentialsCreated: number
  propertiesSkipped: number
  properties: any[]
  existingProperties?: any[] // existed on DBMS — still attempt parser sync
  skippedProperties: Array<{ name: string; reason: string }>
  createdPortfolios?: Array<{ id: string; name: string }>
}
