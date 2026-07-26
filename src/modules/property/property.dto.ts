import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'


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
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
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

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439020',
    description: 'Previous portfolio ID (tracking)'
  })
  @IsString()
  @IsOptional()
  previous_portfolio_id?: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439015'],
    description: 'Portfolio IDs where property is visible',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  show_in_portfolio?: string[]

  @ApiPropertyOptional({
    example: 'newdomains@grandhotel.com',
    description: 'New domain email'
  })
  @IsString()
  @IsOptional()
  new_domain_email?: string

  @ApiPropertyOptional({
    example: ['case1@example.com', 'case2@example.com'],
    description: 'Other case emails',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  others_case_emails?: string[]

  @ApiPropertyOptional({
    example: 'primarycase@grandhotel.com',
    description: 'Primary case email'
  })
  @IsString()
  @IsOptional()
  primary_case_email?: string

  @ApiPropertyOptional({
    example: 'portfolio@grandhotel.com',
    description: 'Portfolio contact email'
  })
  @IsString()
  @IsOptional()
  portfolio_contact_email?: string

  @ApiPropertyOptional({
    example: 'John Smith - Portfolio Manager',
    description: 'Portfolio contact (free text)'
  })
  @IsString()
  @IsOptional()
  portfolio_contact?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Service Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  service_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Currency ID (MongoDB ObjectId reference to Currency collection)'
  })
  @IsMongoId()
  @IsOptional()
  currency_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Priority ID (MongoDB ObjectId reference to Priority collection)'
  })
  @IsMongoId()
  @IsOptional()
  priority_id?: string

  @ApiPropertyOptional({
    example: 'PROP-12345',
    description: 'External property / PMS identifier'
  })
  @IsString()
  @IsOptional()
  property_identifier?: string

  @ApiPropertyOptional({
    example: 'SecurePass123!',
    description: 'Webmail password (will be encrypted)'
  })
  @IsString()
  @IsOptional()
  webmail_password?: string

  @ApiPropertyOptional({
    example: 'Luxury 5-star hotel in downtown with 200 rooms',
    description: 'Description'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    example: '123 Main Street, New York, NY 10001, USA',
    description: 'Hotel address'
  })
  @IsString()
  @IsOptional()
  hotel_address?: string

  @ApiPropertyOptional({
    example: 'Jane Doe - Case Manager',
    description: 'Case Management Contact'
  })
  @IsString()
  @IsOptional()
  case_management_contact?: string

  @ApiPropertyOptional({
    example: 'Mike Johnson - IT Access',
    description: 'Access Contact'
  })
  @IsString()
  @IsOptional()
  access_contact?: string

  @ApiPropertyOptional({
    example: 'Sarah Williams - Reporting Lead',
    description: 'Reporting Contact'
  })
  @IsString()
  @IsOptional()
  reporting_contact?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Expedia Processor ID (MongoDB ObjectId)'
  })
  @IsOptional()
  @IsMongoId()
  expedia_processor_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Booking Processor ID (MongoDB ObjectId)'
  })
  @IsOptional()
  @IsMongoId()
  booking_processor_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Agoda Processor ID (MongoDB ObjectId)'
  })
  @IsOptional()
  @IsMongoId()
  agoda_processor_id?: string

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

  @ApiPropertyOptional({
    example: 'qp_user_grandhotel',
    description: 'QP Username'
  })
  @IsString()
  @IsOptional()
  qp_username?: string

  @ApiPropertyOptional({
    example: 'QPPass123!',
    description: 'QP Password (will be encrypted)'
  })
  @IsString()
  @IsOptional()
  qp_password?: string

  @ApiPropertyOptional({
    example: 'qp_api_key_abc123xyz',
    description: 'QP API Key (will be encrypted)'
  })
  @IsString()
  @IsOptional()
  qp_api_key?: string

  @ApiPropertyOptional({
    example: 'FP-MID-789456',
    description: 'FP MID'
  })
  @IsString()
  @IsOptional()
  fp_mid?: string

  @ApiPropertyOptional({
    example: 'fp_user_grandhotel',
    description: 'FreedomPay username'
  })
  @IsString()
  @IsOptional()
  fp_username?: string

  @ApiPropertyOptional({
    example: 'FPPass123!',
    description: 'FreedomPay password (will be encrypted)'
  })
  @IsString()
  @IsOptional()
  fp_password?: string

  @ApiPropertyOptional({
    example: 'billing@grandhotel.com',
    description: 'Stripe account email'
  })
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
    example: '507f1f77bcf86cd799439099',
    description: 'Expedia Billing Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  expedia_billing_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Expedia Service Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  expedia_service_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Expedia Frequency ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  expedia_frequency_id?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Expedia access level granted'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  expedia_access_level?: boolean

  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Expedia integration start date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  expedia_from?: string

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Expedia integration end date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  expedia_to?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Expedia scheduler enabled'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  expedia_scheduler?: boolean

  @ApiPropertyOptional({
    example: 30,
    description: 'Expedia integration duration in days'
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expedia_duration?: number

  @ApiPropertyOptional({ description: 'Expedia DB duration in days', example: 30 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expedia_db_duration?: number

  @ApiPropertyOptional({ description: 'Expedia service fee', example: 10 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  expedia_service_fee?: number

  @ApiPropertyOptional({ description: 'Expedia CRS' })
  @IsString()
  @IsOptional()
  expedia_crs?: string

  @ApiPropertyOptional({ description: 'Expedia CRS (DB)' })
  @IsString()
  @IsOptional()
  expedia_crs_db?: string

  @ApiPropertyOptional({ description: 'Expedia Run Date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  expedia_run_date?: string

  @ApiPropertyOptional({ description: 'Expedia Run Date DB (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  expedia_run_date_db?: string

  @ApiPropertyOptional({ description: 'Expedia revised date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsString()
  @IsOptional()
  expedia_revised_date?: string

  @ApiPropertyOptional({ description: 'Expedia Scheduler Review From (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  expedia_scheduler_review_from?: string

  @ApiPropertyOptional({ description: 'Expedia Scheduler Review To (YYYY-MM-DD)', example: '2024-12-31' })
  @IsString()
  @IsOptional()
  expedia_scheduler_review_to?: string

  @ApiPropertyOptional({ description: 'Expedia scheduler (DB)' })
  @IsString()
  @IsOptional()
  expedia_scheduler_db?: string

  @ApiPropertyOptional({ description: 'Expedia Scheduler Review DB From (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  expedia_scheduler_review_db_from?: string

  @ApiPropertyOptional({ description: 'Expedia Scheduler Review DB To (YYYY-MM-DD)', example: '2024-12-31' })
  @IsString()
  @IsOptional()
  expedia_scheduler_review_db_to?: string

  @ApiPropertyOptional({ description: 'Expedia credential verified', example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  expedia_credential_verified?: boolean

  @ApiPropertyOptional({ description: 'Expedia OTP number' })
  @IsString()
  @IsOptional()
  expedia_otp_number?: string

  @ApiPropertyOptional({ description: 'From date DB (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  from_db?: string

  @ApiPropertyOptional({ description: 'To date DB (YYYY-MM-DD)', example: '2024-12-31' })
  @IsString()
  @IsOptional()
  to_db?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Booking.com Billing Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  booking_billing_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Booking.com Service Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  booking_service_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Booking.com Frequency ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  booking_frequency_id?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Booking.com access level granted'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  booking_access_level?: boolean

  @ApiPropertyOptional({
    example: '2024-02-01',
    description: 'Booking.com integration start date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  booking_from?: string

  @ApiPropertyOptional({
    example: '2024-11-30',
    description: 'Booking.com integration end date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  booking_to?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Booking.com scheduler enabled'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  booking_scheduler?: boolean

  @ApiPropertyOptional({
    example: 60,
    description: 'Booking.com integration duration in days'
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  booking_duration?: number

  @ApiPropertyOptional({ description: 'Booking service fee', example: 10 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  booking_service_fee?: number

  @ApiPropertyOptional({ description: 'Booking CRS' })
  @IsString()
  @IsOptional()
  booking_crs?: string

  @ApiPropertyOptional({ description: 'Booking Run Date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  booking_run_date?: string

  @ApiPropertyOptional({ description: 'Booking revised date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsString()
  @IsOptional()
  booking_revised_date?: string

  @ApiPropertyOptional({ description: 'Booking credential verified', example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  booking_credential_verified?: boolean

  @ApiPropertyOptional({ description: 'Booking OTP number' })
  @IsString()
  @IsOptional()
  booking_otp_number?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Agoda Billing Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  agoda_billing_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Agoda Service Type ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  agoda_service_type_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439099',
    description: 'Agoda Frequency ID (MongoDB ObjectId)'
  })
  @IsMongoId()
  @IsOptional()
  agoda_frequency_id?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Agoda access level granted'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  agoda_access_level?: boolean

  @ApiPropertyOptional({
    example: '2024-03-15',
    description: 'Agoda integration start date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  agoda_from?: string

  @ApiPropertyOptional({
    example: '2024-09-15',
    description: 'Agoda integration end date (YYYY-MM-DD)'
  })
  @IsString()
  @IsOptional()
  agoda_to?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Agoda scheduler enabled'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  agoda_scheduler?: boolean

  @ApiPropertyOptional({
    example: 90,
    description: 'Agoda integration duration in days'
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  agoda_duration?: number

  @ApiPropertyOptional({ description: 'Agoda service fee', example: 10 })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  agoda_service_fee?: number

  @ApiPropertyOptional({ description: 'Agoda CRS' })
  @IsString()
  @IsOptional()
  agoda_crs?: string

  @ApiPropertyOptional({ description: 'Agoda Run Date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsString()
  @IsOptional()
  agoda_run_date?: string

  @ApiPropertyOptional({ description: 'Agoda revised date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsString()
  @IsOptional()
  agoda_revised_date?: string

  @ApiPropertyOptional({ description: 'Agoda credential verified', example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  agoda_credential_verified?: boolean

  @ApiPropertyOptional({ description: 'Agoda OTP number' })
  @IsString()
  @IsOptional()
  agoda_otp_number?: string

  @ApiPropertyOptional({ description: 'Sales representative name' })
  @IsString()
  @IsOptional()
  sales_rep?: string

  @ApiPropertyOptional({
    example: ['old@hotel.com', 'legacy@hotel.com'],
    description: 'List of discontinued email IDs associated with the property',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  discontinued_email_ids?: string[]

  @ApiPropertyOptional({
    example: '123456789',
    description: 'CyberSource merchant ID'
  })
  @IsString()
  @IsOptional()
  cybersource_mid?: string

  @ApiPropertyOptional({
    example: 'store_001',
    description: 'Adyen location identifier'
  })
  @IsString()
  @IsOptional()
  adyen_location?: string

  @ApiPropertyOptional({
    example: 'billing@hotel.com',
    description: 'Stripe connected account email'
  })
  @IsString()
  @IsOptional()
  stripe_connected_email?: string

  @ApiPropertyOptional({
    example: true,
    description: 'Need another domain for OTA integrations'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  need_another_domain?: boolean

  @ApiPropertyOptional({
    example: '+1-555-123-4567',
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

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class BulkUpdateResultDto {
  @ApiProperty({ example: 10, description: 'Total number of rows processed' })
  totalRows: number

  @ApiProperty({ example: 8, description: 'Number of properties successfully updated' })
  successCount: number

  @ApiProperty({ example: 2, description: 'Number of rows that failed' })
  failureCount: number

  @ApiProperty({
    example: [{ row: 3, propertyName: 'Hotel X', error: 'Property not found' }],
    description: 'List of errors encountered during update'
  })
  errors: Array<{ row: number; propertyName: string; error: string }>

  @ApiProperty({
    example: ['Grand Hotel', 'Ocean View Resort'],
    description: 'List of successfully updated property names'
  })
  successfulUpdates: string[]
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

  @ApiPropertyOptional({ description: 'Filter by service type ID (MongoDB ObjectId)' })
  @IsOptional()
  @IsMongoId()
  service_type_id?: string

  @ApiPropertyOptional({ description: 'Filter by currency ID (MongoDB ObjectId)' })
  @IsOptional()
  @IsMongoId()
  currency_id?: string

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

  @ApiPropertyOptional({ description: 'Expedia billing type ID (MongoDB ObjectId)' })
  @IsOptional()
  @IsMongoId()
  expedia_billing_type_id?: string

  @ApiPropertyOptional({ description: 'Expedia service type ID (MongoDB ObjectId)' })
  @IsOptional()
  @IsMongoId()
  expedia_service_type_id?: string

  @ApiPropertyOptional({ description: 'Expedia frequency ID (MongoDB ObjectId)' })
  @IsOptional()
  @IsMongoId()
  expedia_frequency_id?: string

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

export class TransferPropertyDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'New portfolio ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  portfolio_id: string

  @ApiProperty({ example: 'mySecretPassword', description: 'User account password for confirmation' })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class BulkTransferPropertyDto {
  @ApiProperty({
    description: 'Array of property IDs to transfer',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String]
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[]

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Target portfolio ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  portfolio_id: string

  @ApiProperty({ example: 'mySecretPassword', description: 'User account password for confirmation' })
  @IsString()
  @IsNotEmpty()
  password: string
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
  'currency_id',
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
  'expedia_processor_id',
  'booking_processor_id',
  'agoda_processor_id',
  'from',
  'to',
  'fp_mid',
  'fp_username',
  'stripe_account_email',
  'expedia_billing_type_id',
  'expedia_service_type_id',
  'expedia_frequency_id',
  'expedia_access_level',
  'expedia_from',
  'expedia_to',
  'expedia_scheduler',
  'expedia_duration',
  'booking_billing_type_id',
  'booking_service_type_id',
  'booking_frequency_id',
  'booking_access_level',
  'booking_from',
  'booking_to',
  'booking_scheduler',
  'booking_duration',
  'agoda_billing_type_id',
  'agoda_service_type_id',
  'agoda_frequency_id',
  'agoda_access_level',
  'agoda_from',
  'agoda_to',
  'agoda_scheduler',
  'agoda_duration',
  'need_another_domain',
  'created_at',
  'updated_at',
  'expedia_service_fee',
  'priority_id',
  'from_db',
  'to_db',
  'expedia_revised_date',
  'booking_revised_date',
  'agoda_revised_date',
  'expedia_scheduler_review_from',
  'expedia_scheduler_review_to',
  'expedia_scheduler_review_db_from',
  'expedia_scheduler_review_db_to',
  'expedia_crs',
  'expedia_crs_db',
  'expedia_run_date',
  'expedia_run_date_db',
  'expedia_db_duration',
  'expedia_credential_verified',
  'expedia_otp_number',
  'booking_service_fee',
  'booking_run_date',
  'booking_credential_verified',
  'agoda_service_fee',
  'agoda_run_date',
  'agoda_credential_verified',
  'sales_rep',
  'discontinued_email_ids',
  'cybersource_mid',
  'adyen_location',
  'stripe_connected_email',
  'qp_username',
  'user_name_expedia',
  'user_name_booking',
  'user_name_agoda'
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
  if (name === 'subportfolio_id')
    return { in: [OID] }
  if (name === 'service_type_id')
    return { in: ['507f1f77bcf86cd799439099'] }
  if (name === 'currency_id')
    return { in: ['507f1f77bcf86cd799439099'] }
  if (name === 'priority_id')
    return { in: ['507f1f77bcf86cd799439099'] }
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
    name === 'agoda_scheduler' ||
    name === 'need_another_domain'
  )
    return { in: [true, false] }
  if (
    name.endsWith('_billing_type_id') ||
    name.endsWith('_frequency_id') ||
    name.endsWith('_service_type_id') ||
    name === 'expedia_processor_id' ||
    name === 'booking_processor_id' ||
    name === 'agoda_processor_id'
  ) {
    return { in: ['507f1f77bcf86cd799439099'] }
  }
  if (
    name === 'expedia_from' ||
    name === 'expedia_to' ||
    name === 'booking_from' ||
    name === 'booking_to' ||
    name === 'agoda_from' ||
    name === 'agoda_to' ||
    name === 'from' ||
    name === 'to' ||
    name === 'expedia_revised_date' ||
    name === 'expedia_run_date' ||
    name === 'expedia_run_date_db' ||
    name === 'booking_run_date' ||
    name === 'agoda_run_date' ||
    name === 'expedia_scheduler_review_from' ||
    name === 'expedia_scheduler_review_to' ||
    name === 'expedia_scheduler_review_db_from' ||
    name === 'expedia_scheduler_review_db_to'
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

const PROPERTY_FILTER_ITEM_NAME_DESCRIPTION = `Field to filter or sort. Allowed values: ${PROPERTY_FILTER_FIELD_NAMES_LIST}. Use in: [] with sort_by only for created_at / updated_at. Booleans accept true/false or "true"/"false". IDs (expedia_id, booking_id, agoda_id) and *_duration use numbers in in[]. OTA date range filters: *_from and *_to MUST be provided together as a pair (e.g., expedia_from + expedia_to). When both are present, they create a range filter that finds properties with overlapping date ranges. Individual *_from or *_to filters without their pair are ignored.`

const PROPERTY_FILTER_DTO_FILTERS_DESCRIPTION = `Each item: name (required, one of: ${PROPERTY_FILTER_FIELD_NAMES_LIST}), in (required; OR match; empty only for sort-only on created_at/updated_at), sort_by (optional asc|desc). Root fields: page, limit, search (name, description, hotel_address, property_identifier, portfolio_contact, card_descriptor), start_date, end_date, is_active, masked, user_name, user_password.`

/** Full narrative for POST /property/filter Swagger operation text. */
export const PROPERTY_FILTER_OPERATION_DESCRIPTION =
  `Returns properties with optional pagination. filters[].name must be one of: ${PROPERTY_FILTER_FIELD_NAMES_LIST}. Each filter row: in = array of values (OR match); use in: [] only with sort_by for created_at or updated_at. Boolean fields (expedia_access_level, expedia_scheduler, booking_access_level, booking_scheduler, agoda_access_level, agoda_scheduler) accept true/false or "true"/"false". Numeric in values: expedia_id, booking_id, agoda_id, expedia_duration, booking_duration, agoda_duration. OTA date range filtering: *_from and *_to filters MUST be provided together as pairs (e.g., expedia_from + expedia_to). When both are present, they automatically create a range filter that finds properties where their OTA date ranges overlap with the provided range. Individual *_from or *_to filters without their pair are ignored. Enum strings: billing types VCC, DB, EBS; frequencies REGULAR, ONE_TIME, STOP; processors QuantumPay, Stripe, FreedomPay. currency_id accepts MongoDB ObjectId strings. Root body (outside filters): page, limit, search, start_date, end_date, is_active, masked, user_name, user_password (when masked=false).`

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
    description: 'If true (default), credentials are masked. If false, credentials are decrypted. When false, user_name and user_password are required.',
    example: true
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsOptional()
  @IsBoolean()
  masked?: boolean

  @ApiPropertyOptional({
    description: 'User email for authentication when masked=false. Required when requesting decrypted credentials.',
    example: 'user@example.com'
  })
  @IsOptional()
  @IsString()
  user_name?: string

  @ApiPropertyOptional({
    description: 'User password for authentication when masked=false. Required when requesting decrypted credentials.',
    example: 'password123'
  })
  @IsOptional()
  @IsString()
  user_password?: string
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

  @ApiProperty({ type: [Object], description: 'Unique Expedia Processor objects used across accessible properties' })
  expedia_processor: object[]

  @ApiProperty({ type: [Object], description: 'Unique Booking Processor objects used across accessible properties' })
  booking_processor: object[]

  @ApiProperty({ type: [Object], description: 'Unique Agoda Processor objects used across accessible properties' })
  agoda_processor: object[]

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

  @ApiProperty({ type: [Object], description: 'Unique ServiceType objects used across accessible properties' })
  service_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Currency objects used across accessible properties' })
  currency: object[]

  @ApiProperty({ type: [String] })
  fp_username: string[]

  @ApiProperty({ type: [String] })
  qp_username: string[]

  @ApiProperty({ type: [String] })
  previous_portfolio_id: string[]

  @ApiProperty({ type: [String], description: 'ISO date-time strings' })
  next_due_date: string[]

  @ApiProperty({ type: [Object], description: 'Unique Expedia BillingType objects used across accessible properties' })
  expedia_billing_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Expedia ServiceType objects used across accessible properties' })
  expedia_service_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Expedia Frequency objects used across accessible properties' })
  expedia_frequency: object[]

  @ApiProperty({ type: [String] })
  expedia_from: string[]

  @ApiProperty({ type: [String] })
  expedia_to: string[]

  @ApiProperty({
    description: 'Min/max of expedia_revised_date across accessible properties',
    type: 'object',
    properties: {
      min: { type: 'string', nullable: true, example: '2026-01-10' },
      max: { type: 'string', nullable: true, example: '2026-06-03' }
    }
  })
  expedia_revised_date: { min: string | null; max: string | null }

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

  @ApiProperty({ type: [Object], description: 'Unique Booking BillingType objects used across accessible properties' })
  booking_billing_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Booking ServiceType objects used across accessible properties' })
  booking_service_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Booking Frequency objects used across accessible properties' })
  booking_frequency: object[]

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

  @ApiProperty({ type: [Object], description: 'Unique Agoda BillingType objects used across accessible properties' })
  agoda_billing_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Agoda ServiceType objects used across accessible properties' })
  agoda_service_type: object[]

  @ApiProperty({ type: [Object], description: 'Unique Agoda Frequency objects used across accessible properties' })
  agoda_frequency: object[]

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

  @ApiProperty({ type: [Object], description: 'Unique Priority objects used across accessible properties' })
  priority: object[]
}

export class ExportPropertyExcelDto extends PropertyFilterDto {
  // page and limit are not applicable for export — all matching records are always returned
  declare page?: never
  declare limit?: never
}

export class SyncByOtaDto {
  @IsOptional() @IsInt() expedia_id?: number | null
  @IsOptional() @IsInt() booking_id?: number | null
  @IsOptional() @IsInt() agoda_id?: number | null
  @IsObject() data!: Record<string, any>
}

// ─── Expedia Property Checker ─────────────────────────────────────────────────

export class ExpediaCheckPropertyItemDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Internal MongoDB _id of the property' })
  @IsString()
  @IsNotEmpty()
  _id: string

  @ApiProperty({ example: 12345678, description: 'Expedia property ID' })
  @IsInt()
  expedia_id: number

  @ApiProperty({ example: 'partner@example.com', description: 'Expedia account username (email)' })
  @IsString()
  @IsNotEmpty()
  expedia_username: string

  @ApiProperty({ example: 'secret123', description: 'Expedia account password (never logged)' })
  @IsString()
  @IsNotEmpty()
  expedia_password: string
}

export class ExpediaCheckPropertiesDto {
  @ApiProperty({
    type: [ExpediaCheckPropertyItemDto],
    description: 'List of properties to check. Items are grouped by expedia_username internally.'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpediaCheckPropertyItemDto)
  items: ExpediaCheckPropertyItemDto[]
}

export interface ExpediaCheckerUpstreamItem {
  _id: string
  expedia_id: number
}

export interface ExpediaCheckerUpstreamPayload {
  username: string
  password: string
  expedia_ids: ExpediaCheckerUpstreamItem[]
}

// ─── Agoda Property Checker ───────────────────────────────────────────────────

export class AgodaCheckPropertyItemDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Internal MongoDB _id of the property' })
  @IsString()
  @IsNotEmpty()
  _id: string

  @ApiProperty({ example: 12345678, description: 'Agoda property ID' })
  @Type(() => Number)
  @IsInt()
  agoda_id: number

  @ApiProperty({ example: 'partner@example.com', description: 'Agoda account username (email)' })
  @IsString()
  @IsNotEmpty()
  agoda_username: string

  @ApiProperty({ example: 'secret123', description: 'Agoda account password (never logged)' })
  @IsString()
  @IsNotEmpty()
  agoda_password: string
}

export class AgodaCheckPropertiesDto {
  @ApiProperty({
    type: [AgodaCheckPropertyItemDto],
    description: 'List of properties to check. Items are grouped by agoda_username internally.'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgodaCheckPropertyItemDto)
  items: AgodaCheckPropertyItemDto[]
}

// ─── Sync Bulk Upsert (external JWT endpoint) ────────────────────────────────

export class SyncBulkUpsertItemDto {
  @ApiProperty({ example: 2, description: 'Excel row number for error reporting' })
  @IsInt()
  row: number

  @ApiProperty({ example: 'property-parent-123', description: 'DBMS property ID — used to find/create the property' })
  @IsString()
  @IsNotEmpty()
  parent_id: string

  @ApiProperty({ example: 'Grand Hotel' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'portfolio-parent-123', description: 'DBMS portfolio ID' })
  @IsString()
  @IsNotEmpty()
  portfolio_parent_id: string

  @ApiPropertyOptional({ example: '123 Main Street, New York, NY 10001' })
  @IsString()
  @IsOptional()
  address?: string

  @ApiPropertyOptional({ example: 'USD', description: 'ISO currency code' })
  @IsString()
  @IsOptional()
  currency?: string

  @ApiPropertyOptional({ example: 'GRAND HOTEL NY' })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({ example: 'EXP123456' })
  @IsString()
  @IsOptional()
  expedia_id?: string

  @ApiPropertyOptional({ example: 'hotel@expedia.com' })
  @IsString()
  @IsOptional()
  expedia_username?: string

  @ApiPropertyOptional({ example: 'secret' })
  @IsString()
  @IsOptional()
  expedia_password?: string

  @ApiPropertyOptional({ example: 'AGD123456' })
  @IsString()
  @IsOptional()
  agoda_id?: string

  @ApiPropertyOptional({ example: 'hotel@agoda.com' })
  @IsString()
  @IsOptional()
  agoda_username?: string

  @ApiPropertyOptional({ example: 'secret' })
  @IsString()
  @IsOptional()
  agoda_password?: string

  @ApiPropertyOptional({ example: 'BKG123456' })
  @IsString()
  @IsOptional()
  booking_id?: string

  @ApiPropertyOptional({ example: 'hotel@booking.com' })
  @IsString()
  @IsOptional()
  booking_username?: string

  @ApiPropertyOptional({ example: 'secret' })
  @IsString()
  @IsOptional()
  booking_password?: string
}

export interface SyncBulkUpsertRowResult {
  row: number
  parent_id: string
  name: string
  identifier: string
  action: 'created' | 'updated' | 'failed'
  dbms: boolean
  dashboard: { success: boolean; reason?: string }
  parser: { success: boolean; reason?: string }
  error?: string
}

export interface SyncBulkUpsertResponseDto {
  totalRows: number
  createdCount: number
  updatedCount: number
  failureCount: number
  errors: Array<{ row: number; parent_id: string; error: string }>
  successfulUpserts: Array<{ parent_id: string; action: 'created' | 'updated' }>
}

// ─── Sync Bulk Delete (external JWT endpoint) ────────────────────────────────

export class SyncBulkDeleteItemDto {
  @ApiProperty({ example: 'dbms-property-id-1', description: 'DBMS property ID to delete' })
  @IsString()
  @IsNotEmpty()
  parent_id: string
}

export class SyncBulkDeleteBodyDto {
  @ApiProperty({ type: [SyncBulkDeleteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncBulkDeleteItemDto)
  items: SyncBulkDeleteItemDto[]
}

export interface SyncBulkDeleteResponseDto {
  totalCount: number
  deletedCount: number
  failureCount: number
  errors: Array<{ parent_id: string; error: string }>
  successfulDeletes: Array<{ parent_id: string }>
}

export interface AgodaCheckerUpstreamItem {
  _id: string
  agoda_id: number
}

export interface AgodaCheckerUpstreamPayload {
  username: string
  password: string
  agoda_ids: AgodaCheckerUpstreamItem[]
}