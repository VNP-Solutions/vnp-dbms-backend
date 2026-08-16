import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import { Transform, Type } from 'class-transformer'
import {
  Allow,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator'
import { normalizeParserJobDate } from '../../common/utils/parser-job-date.util'

// ─── Recurring Jobs: DBMS Pre-Check ──────────────────────────────────────────

export const RECURRING_JOB_POSTING_TYPES = ['OTA', 'OTA_PLUS'] as const
export type RecurringJobPostingType =
  (typeof RECURRING_JOB_POSTING_TYPES)[number]

export class RecurringJobPropertyDto {
  @ApiProperty({ example: 'Hotel Grandeur', description: 'Property name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 12345, description: 'Expedia property ID' })
  @IsNumber()
  expedia_id: number

  @ApiProperty({
    example: '2025-06-01',
    description: 'Initial processing date (YYYY-MM-DD)'
  })
  @IsDateString()
  initial_date: string

  @ApiProperty({
    example: '2025-06-15',
    description: 'Recurring processing date (YYYY-MM-DD)'
  })
  @IsDateString()
  recurring_date: string

  @ApiProperty({
    example: 3,
    description: 'Duration in months (1–12)',
    minimum: 1,
    maximum: 12
  })
  @IsNumber()
  @Min(1)
  @Max(12)
  duration: number

  @ApiProperty({
    example: 'OTA',
    enum: RECURRING_JOB_POSTING_TYPES,
    description: 'Posting type'
  })
  @IsIn([...RECURRING_JOB_POSTING_TYPES])
  posting_type: RecurringJobPostingType

  @ApiProperty({
    example: 'VCC',
    description:
      'Billing type (DBMS-only; stripped before forwarding to scraper)'
  })
  @IsString()
  @IsNotEmpty()
  billing_type: string
}

export class DbmsPreCheckDto {
  @ApiProperty({
    type: [RecurringJobPropertyDto],
    description: 'List of properties to pre-check'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringJobPropertyDto)
  properties: RecurringJobPropertyDto[]
}

/** Shape forwarded to scraper backend — billing_type excluded */
export interface ScraperIngestProperty {
  name: string
  expedia_id: number
  initial_date: string
  recurring_date: string
  duration: number
  posting_type: RecurringJobPostingType
}

export interface ScraperIngestPayload {
  properties: ScraperIngestProperty[]
}

export interface DecryptedPropertyCredential {
  id: string
  property_id: string
  expediaUsername: string | null
  expediaPassword: string | null
  agodaUsername: string | null
  agodaPassword: string | null
  bookingUsername: string | null
  bookingPassword: string | null
  expediaSecondaryUsername: string | null
  expediaSecondaryPassword: string | null
  bookingSecondaryUsername: string | null
  bookingSecondaryPassword: string | null
  agodaSecondaryUsername: string | null
  agodaSecondaryPassword: string | null
  expediaEmailAssociated: string | null
  propertyContactEmail: string | null
  portfolioContactEmail: string | null
  multiplePortfolioEmails: string[]
  case_contact_email: string | null
  case_contact_name: string | null
  case_contact_phone: string | null
  reporting_contact_name: string | null
  reporting_contact_email: string | null
  reporting_contact_phone: string | null
  created_at: string
  updated_at: string
}

export interface DecryptedPortfolioCredential {
  id: string
  portfolio_id: string
  portfolio_name: string
  credential_type: string
  url?: string
  username?: string
  password: string
  email?: string
  phone_number?: string
  notes?: string
  is_active: boolean
}

export interface ExternalPortfolioDto {
  id: string
  name: string
  service_type: string
  is_active: boolean
  contact_email: string | null
  portfolio_contact_email: string | null
  portfolio_contact_name: string | null
  portfolio_contact_phone: string | null
  is_commissionable: boolean
  commission: number | null
  attachment: string | null
  attachments: string[]
  contract_signed: boolean | null
  created_at: string
  updated_at: string
  total_properties: number
  total_subportfolios: number
  credentials?: DecryptedPortfolioCredential[]
}

export interface ExternalPropertyDto {
  id: string
  name: string
  card_descriptor: string | null
  is_active: boolean
  next_due_date: string | null
  portfolio_id: string
  portfolio_name: string
  service_type: string | null
  subportfolio_id: string | null
  subportfolio_name: string | null
  previous_portfolio_id: string | null
  show_in_portfolio: string[]
  new_domain_email: string | null
  others_case_emails: string[]
  primary_case_email: string | null
  portfolio_contact_email: string | null
  portfolio_contact: string | null
  webmail_password: string | null
  description: string | null
  hotel_address: string | null
  property_identifier: string | null
  case_management_contact: string | null
  access_contact: string | null
  reporting_contact: string | null
  expedia_processor: string | null
  booking_processor: string | null
  agoda_processor: string | null
  from: string | null
  to: string | null
  qp_username: string | null
  qp_password: string | null
  qp_api_key: string | null
  fp_mid: string | null
  fp_username: string | null
  fp_password: string | null
  stripe_account_email: string | null
  expedia_id: number | null
  expedia_status: string | null
  booking_id: number | null
  booking_status: string | null
  agoda_id: number | null
  agoda_status: string | null
  expedia_billing_type: string | null
  expedia_service_type: string | null
  expedia_frequency: string | null
  expedia_access_level: boolean | null
  expedia_from: string | null
  expedia_to: string | null
  expedia_scheduler: boolean | null
  expedia_duration: number | null
  expedia_db_duration: number | null
  expedia_service_fee: number | null
  priority: string | null
  expedia_crs: string | null
  expedia_crs_db: string | null
  expedia_run_date: string | null
  expedia_run_date_db: string | null
  expedia_revised_date: string | null
  expedia_scheduler_review_from: string | null
  expedia_scheduler_review_to: string | null
  expedia_scheduler_db: string | null
  expedia_scheduler_review_db_from: string | null
  expedia_scheduler_review_db_to: string | null
  expedia_credential_verified: boolean | null
  expedia_otp_number: string | null
  from_db: string | null
  to_db: string | null
  booking_billing_type: string | null
  booking_service_type: string | null
  booking_frequency: string | null
  booking_access_level: boolean | null
  booking_from: string | null
  booking_to: string | null
  booking_scheduler: boolean | null
  booking_duration: number | null
  booking_service_fee: number | null
  booking_crs: string | null
  booking_run_date: string | null
  booking_revised_date: string | null
  booking_credential_verified: boolean | null
  booking_otp_number: string | null
  agoda_billing_type: string | null
  agoda_service_type: string | null
  agoda_frequency: string | null
  agoda_access_level: boolean | null
  agoda_from: string | null
  agoda_to: string | null
  agoda_scheduler: boolean | null
  agoda_duration: number | null
  agoda_service_fee: number | null
  agoda_crs: string | null
  agoda_run_date: string | null
  agoda_revised_date: string | null
  agoda_credential_verified: boolean | null
  agoda_otp_number: string | null
  sales_rep: string | null
  need_another_domain: boolean | null
  booking_otp_phone: string | null
  created_at: string
  updated_at: string
  credentials: DecryptedPropertyCredential | null
}

export interface ExternalSubportfolioDto {
  id: string
  name: string
  portfolio_id: string | null
  portfolio_name: string | null
  description?: string
  is_active: boolean
  total_properties: number
}

export interface ExternalApiQueryDto {
  project_type?: ProjectType
  portfolio_ids?: string[]
  property_ids?: string[]
  subportfolio_ids?: string[]
  is_active?: boolean
  include_credentials?: boolean
}

export class UpdatePropertyCredentialsExternalDto {
  @IsOptional() @IsString()
  expediaUsername?: string

  @IsOptional() @IsString()
  expediaPassword?: string

  @IsOptional() @IsString()
  agodaUsername?: string

  @IsOptional() @IsString()
  agodaPassword?: string

  @IsOptional() @IsString()
  bookingUsername?: string

  @IsOptional() @IsString()
  bookingPassword?: string

  @IsOptional() @IsString()
  expediaSecondaryUsername?: string

  @IsOptional() @IsString()
  expediaSecondaryPassword?: string

  @IsOptional() @IsString()
  bookingSecondaryUsername?: string

  @IsOptional() @IsString()
  bookingSecondaryPassword?: string

  @IsOptional() @IsString()
  agodaSecondaryUsername?: string

  @IsOptional() @IsString()
  agodaSecondaryPassword?: string

  @IsOptional() @IsString()
  expediaEmailAssociated?: string

  @IsOptional() @IsString()
  propertyContactEmail?: string

  @IsOptional() @IsString()
  portfolioContactEmail?: string

  @IsOptional() @IsArray() @IsString({ each: true })
  multiplePortfolioEmails?: string[]

  @IsOptional() @IsString()
  case_contact_email?: string

  @IsOptional() @IsString()
  case_contact_name?: string

  @IsOptional() @IsString()
  case_contact_phone?: string

  @IsOptional() @IsString()
  reporting_contact_name?: string

  @IsOptional() @IsString()
  reporting_contact_email?: string

  @IsOptional() @IsString()
  reporting_contact_phone?: string
}

// ─── Portfolio bulk Booking credential update ─────────────────────────────────

export class BulkUpdatePortfolioBookingCredentialsDto {
  @ApiProperty({
    example: 'hotel@booking.com',
    description:
      'The Booking.com username to match against. Only properties whose stored ' +
      'bookingUsername equals this value will have their credentials updated.'
  })
  @IsString()
  @IsNotEmpty()
  bookingUsername: string

  @ApiProperty({
    example: 'newP@ssw0rd',
    description: 'New Booking.com password to set (will be encrypted at rest)',
    required: false
  })
  @IsOptional()
  @IsString()
  bookingPassword?: string

}

// ─── OTA ID → QP Username lookup ─────────────────────────────────────────────

export class OtaQpLookupDto {
  @ApiProperty({
    type: [Number],
    example: [12345678, 87654321],
    description: 'List of Expedia property IDs to look up',
    required: false,
    default: []
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  expedia_ids?: number[]

  @ApiProperty({
    type: [Number],
    example: [11111111, 22222222],
    description: 'List of Booking property IDs to look up',
    required: false,
    default: []
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  booking_ids?: number[]

  @ApiProperty({
    type: [Number],
    example: [33333333, 44444444],
    description: 'List of Agoda property IDs to look up',
    required: false,
    default: []
  })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  agoda_ids?: number[]
}

// ─── Manual Lambda Trigger ────────────────────────────────────────────────────

export class TriggerLambdaDto {
  @ApiProperty({
    type: String,
    example: 'expedia',
    description:
      'Platform value forwarded as the Lambda payload. ' +
      'Defaults to the EXPEDIA_CHECK_LAMBDA_PLATFORM env var when omitted.',
    required: false
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  platform?: string
}

export interface OtaQpLookupResultItem {
  hotel_id: number
  qp_username: string | null
}

export type OtaQpLookupResult = OtaQpLookupResultItem[]

// ─── Bulk Create Parser Jobs ──────────────────────────────────────────────────

export type ParserJobOtaType = 'expedia' | 'booking' | 'agoda'

export class BulkCreateParserJobsDto {
  @ApiProperty({
    type: [String],
    example: ['prop-id-1', 'prop-id-2'],
    description: 'List of DBMS property IDs for which parser jobs will be created.'
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  property_ids: string[]

  @ApiProperty({
    example: 'expedia',
    enum: ['expedia', 'booking', 'agoda'],
    description: 'OTA type to create jobs for. One job is created per property for this OTA type.'
  })
  @IsString()
  @IsIn(['expedia', 'booking', 'agoda', 'expedia_db'])
  ota_type: ParserJobOtaType
}

/** A single job entry forwarded to the parser backend */
export interface ParserJobEntryPayload {
  /** DBMS property ID */
  parent_id: string
  /** OTA platform this job targets */
  ota_type: ParserJobOtaType
  /** Job window start date (YYYY-MM-DD) — historical_to + 1 day */
  start_date: string
  /** Job window end date  (YYYY-MM-DD) — start_date + CRS months [+ 1 yr for booking] */
  end_date: string
  /** Billing type name for this OTA, if configured */
  billing_type: string | null
  /** 1 when OTA priority is HIGH, otherwise 0 */
  priority: number
}

/** Payload sent to the parser backend's bulk-create endpoint */
export interface BulkCreateParserJobsPayload {
  jobs: ParserJobEntryPayload[]
}

/** Per-property summary returned by the bulk-create service method */
export interface BulkCreateParserJobsPropertyResult {
  property_id: string
  name: string
  /** Jobs successfully queued for this property */
  jobs_created: Array<{
    ota_type: ParserJobOtaType
    start_date: string
    end_date: string
  }>
  /** OTA types skipped due to missing data */
  skipped_otas: Array<{
    ota_type: ParserJobOtaType
    reason: string
  }>
}

// ─── Update Historical To + Run Date ─────────────────────────────────────────

export class UpdateHistoricalAndRunDateDto {
  @ApiProperty({
    example: 'prop-id-1',
    description: 'DBMS property ID (parent_id)'
  })
  @Transform(({ obj }) => obj.parent_id ?? obj.parentId)
  @IsString()
  @IsNotEmpty()
  parent_id: string

  @ApiProperty({
    example: 'expedia',
    enum: ['expedia', 'booking', 'agoda'],
    description: 'OTA platform whose historical-to date and run date will be updated'
  })
  @Transform(({ obj }) => obj.ota_type ?? obj.otaType)
  @IsString()
  @IsIn(['expedia', 'booking', 'agoda'])
  ota_type: ParserJobOtaType

  @ApiPropertyOptional({
    example: '01/15/2024',
    description:
      'Job start date (MM/DD/YYYY or YYYY-MM-DD). Accepted for parser compatibility; not persisted.'
  })
  @Transform(({ obj }) =>
    normalizeParserJobDate(
      obj.start_date ?? obj.startDate ?? obj.job_start_date ?? obj.jobStartDate
    )
  )
  @IsOptional()
  @IsDateString()
  start_date?: string

  @ApiProperty({
    example: '01/31/2024',
    description: 'Job end date (MM/DD/YYYY or YYYY-MM-DD)'
  })
  @Transform(({ obj }) =>
    normalizeParserJobDate(
      obj.end_date ?? obj.endDate ?? obj.job_end_date ?? obj.jobEndDate
    )
  )
  @IsDateString()
  end_date: string

  /** Parser may send camelCase aliases — accepted and mapped above. */
  @Allow()
  @IsOptional()
  parentId?: string

  @Allow()
  @IsOptional()
  otaType?: string

  @Allow()
  @IsOptional()
  startDate?: string

  @Allow()
  @IsOptional()
  endDate?: string
}

/** Response returned after updating historical-to and run date */
export interface UpdateHistoricalAndRunDateResult {
  property_id: string
  ota_type: ParserJobOtaType
  /** end_date written into {ota}_to */
  historical_to_updated: string
  /** Computed run date written into {ota}_run_date_from  (end_date + 1 day + CRS days + 15 days) */
  run_date: string
}

// ─── Bulk Upload Retrieval Jobs ─────────────────────────────────────────────

export interface BulkUploadRetrievalJobsGroup {
  hotel_id: string
  rows: Record<string, unknown>[]
}

/** Payload sent to the scraper backend's bulk-create-from-dbms endpoint */
export interface BulkUploadRetrievalJobsPayload {
  parent_retrieval_name: string
  groups: BulkUploadRetrievalJobsGroup[]
}

export interface BulkUploadRetrievalJobsSummaryItem {
  hotel_id: string
  name: string
}

export interface BulkUploadRetrievalJobsResult {
  relay: {
    status: number
    body: unknown
  }
  summary: BulkUploadRetrievalJobsSummaryItem[]
  payload: BulkUploadRetrievalJobsPayload
}
