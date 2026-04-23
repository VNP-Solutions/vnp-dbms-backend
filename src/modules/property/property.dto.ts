import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import { OtaBillingType, OtaIntegrationFrequency } from '@prisma/client'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export const OTA_PAYMENT_PROCESSORS = [
  'QuantumPay',
  'Stripe',
  'FreedomPay'
] as const

export class PropertyCredentialsInput {
  @ApiPropertyOptional({
    description: 'Expedia login — username or email (single field)'
  })
  @IsString()
  @IsOptional()
  expediaUsername?: string

  @ApiPropertyOptional({ description: 'Expedia password' })
  @IsString()
  @IsOptional()
  expediaPassword?: string

  @ApiPropertyOptional({
    description: 'Agoda login — username or email (single field)'
  })
  @IsString()
  @IsOptional()
  agodaUsername?: string

  @ApiPropertyOptional({ description: 'Agoda password' })
  @IsString()
  @IsOptional()
  agodaPassword?: string

  @ApiPropertyOptional({
    description: 'Booking.com login — username or email (single field)'
  })
  @IsString()
  @IsOptional()
  bookingUsername?: string

  @ApiPropertyOptional({ description: 'Booking.com password' })
  @IsString()
  @IsOptional()
  bookingPassword?: string

  @ApiPropertyOptional({ description: 'Expedia secondary username' })
  @IsString()
  @IsOptional()
  expediaSecondaryUsername?: string

  @ApiPropertyOptional({ description: 'Expedia secondary password' })
  @IsString()
  @IsOptional()
  expediaSecondaryPassword?: string

  @ApiPropertyOptional({ description: 'Booking.com secondary username' })
  @IsString()
  @IsOptional()
  bookingSecondaryUsername?: string

  @ApiPropertyOptional({ description: 'Booking.com secondary password' })
  @IsString()
  @IsOptional()
  bookingSecondaryPassword?: string

  @ApiPropertyOptional({ description: 'Agoda secondary username' })
  @IsString()
  @IsOptional()
  agodaSecondaryUsername?: string

  @ApiPropertyOptional({ description: 'Agoda secondary password' })
  @IsString()
  @IsOptional()
  agodaSecondaryPassword?: string

  @ApiPropertyOptional({
    description: 'Expedia email associated with the account'
  })
  @IsString()
  @IsOptional()
  expediaEmailAssociated?: string

  @ApiPropertyOptional({ description: 'Property contact email' })
  @IsString()
  @IsOptional()
  propertyContactEmail?: string

  @ApiPropertyOptional({ description: 'Portfolio contact email' })
  @IsString()
  @IsOptional()
  portfolioContactEmail?: string

  @ApiPropertyOptional({
    description: 'Multiple portfolio emails',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  multiplePortfolioEmails?: string[]
}

export class CreatePropertyDto {
  @ApiProperty({ example: 'Grand Hotel', description: 'Property name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({
    example: 'GRAND HOTEL NY',
    description: 'Card descriptor'
  })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Whether property is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Next due date'
  })
  @IsDateString()
  @IsOptional()
  next_due_date?: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'Portfolio ID'
  })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439014',
    description: 'Subportfolio ID'
  })
  @IsString()
  @IsOptional()
  subportfolio_id?: string

  @ApiPropertyOptional({ description: 'Previous portfolio ID (tracking)' })
  @IsString()
  @IsOptional()
  previous_portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Portfolio IDs where property is visible',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  show_in_portfolio?: string[]

  @ApiPropertyOptional({ description: 'New domain email' })
  @IsString()
  @IsOptional()
  new_domain_email?: string

  @ApiPropertyOptional({ description: 'Other case emails', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  others_case_emails?: string[]

  @ApiPropertyOptional({ description: 'Primary case email' })
  @IsString()
  @IsOptional()
  primary_case_email?: string

  @ApiPropertyOptional({ description: 'Portfolio contact email' })
  @IsString()
  @IsOptional()
  portfolio_contact_email?: string

  @ApiPropertyOptional({ description: 'Portfolio contact (free text)' })
  @IsString()
  @IsOptional()
  portfolio_contact?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Optional service type ID (overrides portfolio default when set)'
  })
  @IsString()
  @IsOptional()
  service_type_id?: string

  @ApiPropertyOptional({ description: 'External property / PMS identifier' })
  @IsString()
  @IsOptional()
  property_identifier?: string

  @ApiPropertyOptional({ description: 'Webmail password (will be encrypted)' })
  @IsString()
  @IsOptional()
  webmail_password?: string

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ description: 'Hotel address' })
  @IsString()
  @IsOptional()
  hotel_address?: string

  @ApiPropertyOptional({ description: 'Case Management Contact' })
  @IsString()
  @IsOptional()
  case_management_contact?: string

  @ApiPropertyOptional({ description: 'Access Contact' })
  @IsString()
  @IsOptional()
  access_contact?: string

  @ApiPropertyOptional({ description: 'Reporting Contact' })
  @IsString()
  @IsOptional()
  reporting_contact?: string

  @ApiPropertyOptional({
    description: 'Expedia Processor',
    enum: OTA_PAYMENT_PROCESSORS
  })
  @IsOptional()
  @IsIn([...OTA_PAYMENT_PROCESSORS])
  expedia_processor?: (typeof OTA_PAYMENT_PROCESSORS)[number]

  @ApiPropertyOptional({
    description: 'Booking Processor',
    enum: OTA_PAYMENT_PROCESSORS
  })
  @IsOptional()
  @IsIn([...OTA_PAYMENT_PROCESSORS])
  booking_processor?: (typeof OTA_PAYMENT_PROCESSORS)[number]

  @ApiPropertyOptional({
    description: 'Agoda Processor',
    enum: OTA_PAYMENT_PROCESSORS
  })
  @IsOptional()
  @IsIn([...OTA_PAYMENT_PROCESSORS])
  agoda_processor?: (typeof OTA_PAYMENT_PROCESSORS)[number]

  @ApiPropertyOptional({ 
    description: 'From date (YYYY-MM-DD format)',
    example: '2024-01-01'
  })
  @IsString()
  @IsOptional()
  from?: string

  @ApiPropertyOptional({ 
    description: 'To date (YYYY-MM-DD format)',
    example: '2024-12-31'
  })
  @IsString()
  @IsOptional()
  to?: string

  @ApiPropertyOptional({ description: 'QP Username' })
  @IsString()
  @IsOptional()
  qp_username?: string

  @ApiPropertyOptional({ description: 'QP Password (will be encrypted)' })
  @IsString()
  @IsOptional()
  qp_password?: string

  @ApiPropertyOptional({ description: 'QP API Key (will be encrypted)' })
  @IsString()
  @IsOptional()
  qp_api_key?: string

  @ApiPropertyOptional({ description: 'FP MID' })
  @IsString()
  @IsOptional()
  fp_mid?: string

  @ApiPropertyOptional({ description: 'FreedomPay username' })
  @IsString()
  @IsOptional()
  fp_username?: string

  @ApiPropertyOptional({ description: 'FreedomPay password (will be encrypted)' })
  @IsString()
  @IsOptional()
  fp_password?: string

  @ApiPropertyOptional({ description: 'Stripe account email' })
  @IsString()
  @IsOptional()
  stripe_account_email?: string

  @ApiPropertyOptional({ description: 'Expedia ID', example: 123456 })
  @IsOptional()
  expedia_id?: number

  @ApiPropertyOptional({ description: 'Expedia Status', example: 'Active' })
  @IsString()
  @IsOptional()
  expedia_status?: string

  @ApiPropertyOptional({ description: 'Booking.com ID', example: 789012 })
  @IsOptional()
  booking_id?: number

  @ApiPropertyOptional({ description: 'Booking.com Status', example: 'Active' })
  @IsString()
  @IsOptional()
  booking_status?: string

  @ApiPropertyOptional({ description: 'Agoda ID', example: 345678 })
  @IsOptional()
  agoda_id?: number

  @ApiPropertyOptional({ description: 'Agoda Status', example: 'Active' })
  @IsString()
  @IsOptional()
  agoda_status?: string

  @ApiPropertyOptional({ enum: OtaBillingType })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaBillingType)
  @IsOptional()
  expedia_billing_type?: OtaBillingType

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expedia_service_type?: string

  @ApiPropertyOptional({ enum: OtaIntegrationFrequency })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaIntegrationFrequency)
  @IsOptional()
  expedia_frequency?: OtaIntegrationFrequency

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  expedia_access_level?: boolean

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expedia_from?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  expedia_to?: string

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  expedia_scheduler?: boolean

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expedia_duration?: number

  @ApiPropertyOptional({ enum: OtaBillingType })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaBillingType)
  @IsOptional()
  booking_billing_type?: OtaBillingType

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  booking_service_type?: string

  @ApiPropertyOptional({ enum: OtaIntegrationFrequency })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaIntegrationFrequency)
  @IsOptional()
  booking_frequency?: OtaIntegrationFrequency

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  booking_access_level?: boolean

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  booking_from?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  booking_to?: string

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  booking_scheduler?: boolean

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  booking_duration?: number

  @ApiPropertyOptional({ enum: OtaBillingType })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaBillingType)
  @IsOptional()
  agoda_billing_type?: OtaBillingType

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  agoda_service_type?: string

  @ApiPropertyOptional({ enum: OtaIntegrationFrequency })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsEnum(OtaIntegrationFrequency)
  @IsOptional()
  agoda_frequency?: OtaIntegrationFrequency

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  agoda_access_level?: boolean

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  agoda_from?: string

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  agoda_to?: string

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  agoda_scheduler?: boolean

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  agoda_duration?: number

  @ApiPropertyOptional({
    description: 'Need another domain for OTA integrations'
  })
  @IsBoolean()
  @IsOptional()
  need_another_domain?: boolean

  @ApiPropertyOptional({
    description: 'Booking.com OTP phone number'
  })
  @IsString()
  @IsOptional()
  booking_otp_phone?: string

  @ApiPropertyOptional({
    description: 'Property credentials (OTA login details)',
    type: PropertyCredentialsInput
  })
  @ValidateNested()
  @Type(() => PropertyCredentialsInput)
  @IsOptional()
  credentials?: PropertyCredentialsInput
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({
    description: 'Set is_active (use activate/deactivate endpoints if needed)'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({
    description: 'Property credentials (OTA login details)',
    type: PropertyCredentialsInput
  })
  @ValidateNested()
  @Type(() => PropertyCredentialsInput)
  @IsOptional()
  credentials?: PropertyCredentialsInput
}

export const REQUIRED_FIELD_VALUES = [
  'expedia',
  'booking',
  'agoda',
  'webmail_password',
  'qp_api_key',
  'qp_password'
] as const

export type RequiredFieldType = (typeof REQUIRED_FIELD_VALUES)[number]

export class GetPropertyCredentialDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsString()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({
    example: 'expedia',
    description: 'Credential type to retrieve',
    enum: REQUIRED_FIELD_VALUES
  })
  @IsIn(REQUIRED_FIELD_VALUES)
  required_field: RequiredFieldType

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Property ID'
  })
  @IsString()
  @IsNotEmpty()
  property_id: string
}

export class PropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by property name (case-insensitive partial match)',
    example: 'Hotel'
  })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio name (case-insensitive partial match)',
    example: 'Portfolio A'
  })
  @IsOptional()
  @IsString()
  portfolio_name?: string

  @ApiPropertyOptional({
    description: 'Filter by subportfolio ID',
    example: '507f1f77bcf86cd799439014'
  })
  @IsOptional()
  @IsString()
  subportfolio_id?: string

  @ApiPropertyOptional({
    description:
      'Filter by active status: All (both), true (active only), false (inactive only)',
    example: 'All',
    enum: ['All', 'true', 'false']
  })
  @IsOptional()
  @IsIn(['All', 'true', 'false'])
  is_active?: 'All' | 'true' | 'false'

  @ApiPropertyOptional({
    description: 'Start date for created_at filter (ISO)'
  })
  @IsOptional()
  @IsString()
  start_date?: string

  @ApiPropertyOptional({ description: 'End date for created_at filter (ISO)' })
  @IsOptional()
  @IsString()
  end_date?: string

  @ApiPropertyOptional({ description: 'Filter by Expedia ID' })
  @IsOptional()
  expedia_id?: number

  @ApiPropertyOptional({ description: 'Filter by Expedia Status' })
  @IsOptional()
  @IsString()
  expedia_status?: string

  @ApiPropertyOptional({ description: 'Filter by Booking.com ID' })
  @IsOptional()
  booking_id?: number

  @ApiPropertyOptional({ description: 'Filter by Booking.com Status' })
  @IsOptional()
  @IsString()
  booking_status?: string

  @ApiPropertyOptional({ description: 'Filter by Agoda ID' })
  @IsOptional()
  agoda_id?: number

  @ApiPropertyOptional({ description: 'Filter by Agoda Status' })
  @IsOptional()
  @IsString()
  agoda_status?: string

  @ApiPropertyOptional({ description: 'Filter by card descriptor' })
  @IsOptional()
  @IsString()
  card_descriptor?: string

  @ApiPropertyOptional({ description: 'Filter by next due date (ISO format)' })
  @IsOptional()
  @IsString()
  next_due_date?: string

  @ApiPropertyOptional({ description: 'Filter by previous portfolio ID' })
  @IsOptional()
  @IsString()
  previous_portfolio_id?: string

  @ApiPropertyOptional({ description: 'Filter by new domain email' })
  @IsOptional()
  @IsString()
  new_domain_email?: string

  @ApiPropertyOptional({ description: 'Filter by primary case email' })
  @IsOptional()
  @IsString()
  primary_case_email?: string

  @ApiPropertyOptional({ description: 'Filter by portfolio contact email' })
  @IsOptional()
  @IsString()
  portfolio_contact_email?: string

  @ApiPropertyOptional({ description: 'Filter by service type ID' })
  @IsOptional()
  @IsString()
  service_type_id?: string

  @ApiPropertyOptional({ description: 'Filter by property identifier (partial match)' })
  @IsOptional()
  @IsString()
  property_identifier?: string

  @ApiPropertyOptional({ description: 'Filter by portfolio contact (partial match)' })
  @IsOptional()
  @IsString()
  portfolio_contact?: string

  @ApiPropertyOptional({ description: 'Filter by FP username' })
  @IsOptional()
  @IsString()
  fp_username?: string

  @ApiPropertyOptional({ enum: OtaBillingType })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsOptional()
  @IsEnum(OtaBillingType)
  expedia_billing_type?: OtaBillingType

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expedia_service_type?: string

  @ApiPropertyOptional({ enum: OtaIntegrationFrequency })
  @Transform(({ value }) => value?.toString().toUpperCase())
  @IsOptional()
  @IsEnum(OtaIntegrationFrequency)
  expedia_frequency?: OtaIntegrationFrequency

  @ApiPropertyOptional({ description: 'Filter by description (partial match)' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ description: 'Filter by hotel address (partial match)' })
  @IsOptional()
  @IsString()
  hotel_address?: string

  @ApiPropertyOptional({ description: 'Filter by QP username' })
  @IsOptional()
  @IsString()
  qp_username?: string

  @ApiPropertyOptional({
    description: 'Filter by access lost status',
    example: false
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Handle string booleans from query params/Swagger
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true' || value === '1') return true
      if (value.toLowerCase() === 'false' || value === '0') return false
    }
    // Return as-is if already boolean or other type
    return value
  })
  @IsBoolean()
  access_lost?: boolean

  @ApiPropertyOptional({
    description:
      'If true (default), credentials are masked/encrypted. If false, credentials are decrypted. When false, user_name and user_password may be required for validation.',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true' || value === '1') return true
      if (value.toLowerCase() === 'false' || value === '0') return false
    }
    return value
  })
  @IsBoolean()
  masked?: boolean

  @ApiPropertyOptional({
    description:
      'User email/username for validation when masked=false. Required when masked=false with credential validation enabled.'
  })
  @IsOptional()
  @IsString()
  user_name?: string

  @ApiPropertyOptional({
    description:
      'User password for validation when masked=false. Required when masked=false with credential validation enabled.'
  })
  @IsOptional()
  @IsString()
  user_password?: string
}

export class BulkDeletePropertyDto {
  @ApiProperty({
    description: 'Array of property IDs to delete',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[]
}

/** Allowed `filters[].name` values for POST /property/filter (keep in sync with property.service switch). */
export const PROPERTY_FILTER_FIELD_NAMES = [
  'portfolio_id',
  'property_id',
  'subportfolio_id',
  'service_type_id',
  'property_identifier',
  'portfolio_contact',
  'expedia_id',
  'booking_id',
  'agoda_id',
  'card_descriptor',
  'hotel_address',
  'new_domain_email',
  'portfolio_contact_email',
  'primary_case_email',
  'expedia_status',
  'booking_status',
  'agoda_status',
  'case_management_contact',
  'access_contact',
  'reporting_contact',
  'expedia_processor',
  'booking_processor',
  'agoda_processor',
  'from',
  'to',
  'fp_mid',
  'fp_username',
  'stripe_account_email',
  'expedia_billing_type',
  'expedia_service_type',
  'expedia_frequency',
  'expedia_access_level',
  'expedia_from',
  'expedia_to',
  'expedia_scheduler',
  'expedia_duration',
  'booking_billing_type',
  'booking_service_type',
  'booking_frequency',
  'booking_access_level',
  'booking_from',
  'booking_to',
  'booking_scheduler',
  'booking_duration',
  'agoda_billing_type',
  'agoda_service_type',
  'agoda_frequency',
  'agoda_access_level',
  'agoda_from',
  'agoda_to',
  'agoda_scheduler',
  'agoda_duration',
  'created_at',
  'updated_at'
] as const

export type PropertyFilterFieldName = (typeof PROPERTY_FILTER_FIELD_NAMES)[number]

const OID = '507f1f77bcf86cd799439013'

function swaggerExampleForFilterName(name: PropertyFilterFieldName): {
  in: (string | number | boolean)[]
  sort_by?: 'asc' | 'desc'
} {
  if (name === 'created_at' || name === 'updated_at')
    return { in: [], sort_by: 'desc' }
  if (name === 'portfolio_id')
    return { in: [OID, '507f1f77bcf86cd799439014'], sort_by: 'asc' }
  if (name === 'property_id')
    return { in: ['507f1f77bcf86cd799439015'] }
  if (name === 'subportfolio_id' || name === 'service_type_id')
    return { in: [OID] }
  if (
    name === 'expedia_id' ||
    name === 'booking_id' ||
    name === 'agoda_id' ||
    name === 'expedia_duration' ||
    name === 'booking_duration' ||
    name === 'agoda_duration'
  )
    return { in: [123456] }
  if (
    name === 'expedia_access_level' ||
    name === 'expedia_scheduler' ||
    name === 'booking_access_level' ||
    name === 'booking_scheduler' ||
    name === 'agoda_access_level' ||
    name === 'agoda_scheduler'
  )
    return { in: [true, false] }
  if (
    name.endsWith('_billing_type') ||
    name.endsWith('_frequency') ||
    name === 'expedia_processor' ||
    name === 'booking_processor' ||
    name === 'agoda_processor'
  ) {
    if (name.endsWith('_billing_type')) return { in: ['VCC', 'DB'] }
    if (name.endsWith('_frequency')) return { in: ['REGULAR', 'ONE_TIME'] }
    return { in: ['QuantumPay', 'Stripe'] }
  }
  if (name.endsWith('_service_type')) return { in: ['HotelCollect', 'ExpediaCollect'] }
  if (
    name === 'expedia_from' ||
    name === 'expedia_to' ||
    name === 'booking_from' ||
    name === 'booking_to' ||
    name === 'agoda_from' ||
    name === 'agoda_to' ||
    name === 'from' ||
    name === 'to'
  )
    return { in: ['2024-01-01', '2024-12-31'] }
  return { in: [`example-${name}`] }
}

/** One filter row per allowed field — for Swagger “all fields” body example. */
export const PROPERTY_FILTER_SWAGGER_EXAMPLE_FILTERS =
  PROPERTY_FILTER_FIELD_NAMES.map((name) => {
    const row = swaggerExampleForFilterName(name)
    return { name, ...row }
  })

const PROPERTY_FILTER_FIELD_NAMES_LIST = PROPERTY_FILTER_FIELD_NAMES.join(', ')

const PROPERTY_FILTER_ITEM_NAME_DESCRIPTION = `Field to filter or sort. Allowed values: ${PROPERTY_FILTER_FIELD_NAMES_LIST}. Use in: [] with sort_by only for created_at / updated_at. Booleans accept true/false or "true"/"false". IDs (expedia_id, booking_id, agoda_id) and *_duration use numbers in in[].`

const PROPERTY_FILTER_DTO_FILTERS_DESCRIPTION = `Each item: name (required, one of: ${PROPERTY_FILTER_FIELD_NAMES_LIST}), in (required; OR match; empty only for sort-only on created_at/updated_at), sort_by (optional asc|desc). Root fields: page, limit, search (name, description, hotel_address, property_identifier, portfolio_contact, card_descriptor), start_date, end_date, is_active, masked, user_name, user_password.`

/** Full narrative for POST /property/filter Swagger operation text. */
export const PROPERTY_FILTER_OPERATION_DESCRIPTION =
  `Returns properties with optional pagination. filters[].name must be one of: ${PROPERTY_FILTER_FIELD_NAMES_LIST}. Each filter row: in = array of values (OR match); use in: [] only with sort_by for created_at or updated_at. Boolean fields (expedia_access_level, expedia_scheduler, booking_access_level, booking_scheduler, agoda_access_level, agoda_scheduler) accept true/false or "true"/"false". Numeric in values: expedia_id, booking_id, agoda_id, expedia_duration, booking_duration, agoda_duration. Enum strings: billing types VCC, DB, EBS; frequencies REGULAR, ONE_TIME, STOP; processors QuantumPay, Stripe, FreedomPay. Root body (outside filters): page, limit, search, start_date, end_date, is_active, masked, user_name, user_password (when masked=false).`

export class PropertyFilterItem {
  @ApiProperty({
    description: PROPERTY_FILTER_ITEM_NAME_DESCRIPTION,
    example: 'portfolio_id',
    enum: [...PROPERTY_FILTER_FIELD_NAMES]
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([...PROPERTY_FILTER_FIELD_NAMES])
  name: PropertyFilterFieldName

  @ApiPropertyOptional({
    description: 'Sort order for this field (applied in array order for multi-field sorting)',
    example: 'asc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_by?: 'asc' | 'desc'

  @ApiProperty({
    description:
      'Values to match with OR semantics. Use [] only for sort-only rows (created_at, updated_at) together with sort_by.',
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    type: [String]
  })
  @IsArray()
  in: (string | number | boolean)[]
}

export class PropertyFilterDto {
  @ApiPropertyOptional({
    description: PROPERTY_FILTER_DTO_FILTERS_DESCRIPTION,
    type: [PropertyFilterItem],
    example: PROPERTY_FILTER_SWAGGER_EXAMPLE_FILTERS
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyFilterItem)
  filters?: PropertyFilterItem[]

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number

  @ApiPropertyOptional({
    description:
      'Search term (case-insensitive contains) across name, description, hotel_address, property_identifier, portfolio_contact, card_descriptor',
    example: 'Hotel'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter by creation date from (YYYY-MM-DD format)',
    example: '2024-01-01'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  start_date?: Date

  @ApiPropertyOptional({
    description: 'Filter by creation date to (YYYY-MM-DD format)',
    example: '2024-12-31'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  end_date?: Date

  @ApiPropertyOptional({
    description: 'Filter by active status (true/false/All). true=active only, false=inactive only, All or omit=both',
    example: true
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined
    if (String(value).toLowerCase() === 'all') return undefined
    if (value === true || value === 'true') return true
    if (value === false || value === 'false') return false
    return value
  })
  @IsBoolean()
  is_active?: boolean

  @ApiPropertyOptional({
    description: 'If true (default), credentials are masked. If false, credentials are decrypted.',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  masked?: boolean
}

/** GET /property/global-filter — portfolio row */
export class GlobalFilterIdNameDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string
}

/** GET /property/global-filter — subportfolio row */
export class GlobalFilterSubportfolioDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  portfolio_id: string
}

/** GET /property/global-filter — service type row */
export class GlobalFilterServiceTypeDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  type: string
}

/**
 * Response shape for GET /property/global-filter.
 * Each array contains unique values from accessible portfolios + properties (for dropdowns / group filter).
 */
export class AllDataForGlobalFilterResponseDto {
  @ApiProperty({ type: [String] })
  expedia_id: string[]

  @ApiProperty({ type: [GlobalFilterIdNameDto] })
  portfolio: GlobalFilterIdNameDto[]

  @ApiProperty({ type: [GlobalFilterIdNameDto] })
  property: GlobalFilterIdNameDto[]

  @ApiProperty({ type: [String] })
  portfolio_id: string[]

  @ApiProperty({ type: [GlobalFilterSubportfolioDto] })
  subportfolio: GlobalFilterSubportfolioDto[]

  @ApiProperty({ type: [String] })
  booking_id: string[]

  @ApiProperty({ type: [String] })
  agoda_id: string[]

  @ApiProperty({ type: [String] })
  hotel_address: string[]

  @ApiProperty({ type: [String] })
  card_descriptor: string[]

  @ApiProperty({ type: [String] })
  new_domain_email: string[]

  @ApiProperty({ type: [String] })
  portfolio_contact_email: string[]

  @ApiProperty({ type: [String] })
  case_contact_email: string[]

  @ApiProperty({ type: [String] })
  case_management_contact: string[]

  @ApiProperty({ type: [String] })
  access_contact: string[]

  @ApiProperty({ type: [String] })
  reporting_contact: string[]

  @ApiProperty({ type: [String] })
  description: string[]

  @ApiProperty({ type: [String] })
  expedia_status: string[]

  @ApiProperty({ type: [String] })
  booking_status: string[]

  @ApiProperty({ type: [String] })
  agoda_status: string[]

  @ApiProperty({ type: [String] })
  expedia_processor: string[]

  @ApiProperty({ type: [String] })
  booking_processor: string[]

  @ApiProperty({ type: [String] })
  agoda_processor: string[]

  @ApiProperty({ type: [String] })
  fp_mid: string[]

  @ApiProperty({ type: [String] })
  stripe_account_email: string[]

  @ApiProperty({ type: [String] })
  from: string[]

  @ApiProperty({ type: [String] })
  to: string[]

  @ApiProperty({ type: [String] })
  property_identifier: string[]

  @ApiProperty({ type: [String] })
  portfolio_contact: string[]

  @ApiProperty({ type: [GlobalFilterServiceTypeDto] })
  service_type: GlobalFilterServiceTypeDto[]

  @ApiProperty({ type: [String] })
  service_type_id: string[]

  @ApiProperty({ type: [String] })
  fp_username: string[]

  @ApiProperty({ type: [String] })
  qp_username: string[]

  @ApiProperty({ type: [String] })
  previous_portfolio_id: string[]

  @ApiProperty({ type: [String], description: 'ISO date-time strings' })
  next_due_date: string[]

  @ApiProperty({ type: [String] })
  expedia_billing_type: string[]

  @ApiProperty({ type: [String] })
  expedia_service_type: string[]

  @ApiProperty({ type: [String] })
  expedia_frequency: string[]

  @ApiProperty({ type: [String] })
  expedia_from: string[]

  @ApiProperty({ type: [String] })
  expedia_to: string[]

  @ApiProperty({ type: [String] })
  expedia_duration: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  expedia_access_level: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  expedia_scheduler: string[]

  @ApiProperty({ type: [String] })
  booking_billing_type: string[]

  @ApiProperty({ type: [String] })
  booking_service_type: string[]

  @ApiProperty({ type: [String] })
  booking_frequency: string[]

  @ApiProperty({ type: [String] })
  booking_from: string[]

  @ApiProperty({ type: [String] })
  booking_to: string[]

  @ApiProperty({ type: [String] })
  booking_duration: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  booking_access_level: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  booking_scheduler: string[]

  @ApiProperty({ type: [String] })
  agoda_billing_type: string[]

  @ApiProperty({ type: [String] })
  agoda_service_type: string[]

  @ApiProperty({ type: [String] })
  agoda_frequency: string[]

  @ApiProperty({ type: [String] })
  agoda_from: string[]

  @ApiProperty({ type: [String] })
  agoda_to: string[]

  @ApiProperty({ type: [String] })
  agoda_duration: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  agoda_access_level: string[]

  @ApiProperty({
    type: [String],
    description: 'Boolean values serialized as "true" / "false"'
  })
  agoda_scheduler: string[]

  @ApiProperty({
    type: [String],
    description: 'From Property.need_another_domain as "true" / "false"'
  })
  need_another_domain: string[]

  @ApiProperty({ type: [String] })
  booking_otp_phone: string[]

  @ApiProperty({ type: [String] })
  expedia_secondary_username: string[]

  @ApiProperty({ type: [String] })
  booking_secondary_username: string[]

  @ApiProperty({ type: [String] })
  agoda_secondary_username: string[]
}
