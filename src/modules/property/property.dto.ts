import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class PropertyCredentialsInput {
  @ApiPropertyOptional({ description: 'Expedia username' })
  @IsString()
  @IsOptional()
  expediaUsername?: string

  @ApiPropertyOptional({ description: 'Expedia password' })
  @IsString()
  @IsOptional()
  expediaPassword?: string

  @ApiPropertyOptional({ description: 'Agoda username' })
  @IsString()
  @IsOptional()
  agodaUsername?: string

  @ApiPropertyOptional({ description: 'Agoda password' })
  @IsString()
  @IsOptional()
  agodaPassword?: string

  @ApiPropertyOptional({ description: 'Booking.com username' })
  @IsString()
  @IsOptional()
  bookingUsername?: string

  @ApiPropertyOptional({ description: 'Booking.com password' })
  @IsString()
  @IsOptional()
  bookingPassword?: string

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

  @ApiPropertyOptional({ description: 'Expedia Processor' })
  @IsString()
  @IsOptional()
  expedia_processor?: string

  @ApiPropertyOptional({ description: 'Booking Processor' })
  @IsString()
  @IsOptional()
  booking_processor?: string

  @ApiPropertyOptional({ description: 'Agoda Processor' })
  @IsString()
  @IsOptional()
  agoda_processor?: string

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

export class PropertyFilterItem {
  @ApiProperty({
    description: 'Name of the field to filter or sort',
    example: 'portfolio_id',
    enum: [
      'portfolio_id',
      'property_id',
      'subportfolio_id',
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
      'stripe_account_email',
      'created_at',
      'updated_at'
    ]
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({
    description: 'Sort order for this field (applied in array order for multi-field sorting)',
    example: 'asc',
    enum: ['asc', 'desc']
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_by?: 'asc' | 'desc'

  @ApiProperty({
    description: 'Array of values to filter by (OR condition). For sort-only fields like created_at or updated_at, you can pass an empty array []',
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    type: [String]
  })
  @IsArray()
  @IsNotEmpty()
  in: (string | number | boolean)[]
}

export class PropertyFilterDto {
  @ApiPropertyOptional({
    description: 'Array of filter items. Each filter supports multiple values (OR condition) and optional sort_by. Sorting is applied in array order for multi-field sorting. Available fields: portfolio_id, property_id, subportfolio_id, expedia_id, booking_id, agoda_id, card_descriptor, hotel_address, new_domain_email, portfolio_contact_email, primary_case_email, expedia_status, booking_status, agoda_status, case_management_contact, access_contact, reporting_contact, expedia_processor, booking_processor, agoda_processor, from, to, fp_mid, stripe_account_email, created_at, updated_at. For sort-only fields (created_at, updated_at): use in:[] with sort_by',
    type: [PropertyFilterItem],
    example: [
      {
        name: 'portfolio_id',
        sort_by: 'asc',
        in: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
      },
      {
        name: 'property_id',
        in: ['507f1f77bcf86cd799439015']
      },
      {
        name: 'expedia_id',
        sort_by: 'desc',
        in: ['EXP123', 'EXP456']
      },
      {
        name: 'booking_id',
        in: ['BK789', 'BK012']
      },
      {
        name: 'agoda_id',
        in: ['AG345', 'AG678']
      },
      {
        name: 'card_descriptor',
        in: ['VISA1234', 'MASTER5678']
      },
      {
        name: 'hotel_address',
        in: ['123 Main St', '456 Oak Ave']
      },
      {
        name: 'new_domain_email',
        in: ['hotel1@example.com', 'hotel2@example.com']
      },
      {
        name: 'portfolio_contact_email',
        in: ['contact1@example.com']
      },
      {
        name: 'primary_case_email',
        in: ['case@example.com']
      },
      {
        name: 'expedia_status',
        in: ['active', 'inactive']
      },
      {
        name: 'booking_status',
        in: ['confirmed']
      },
      {
        name: 'agoda_status',
        in: ['pending']
      },
      {
        name: 'is_active',
        sort_by: 'asc',
        in: [true, false]
      }
    ]
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
    description: 'Search term for text fields (searches across name, description, hotel_address)',
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
