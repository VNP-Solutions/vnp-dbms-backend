import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreatePropertyCredentialsDto {
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

  @ApiPropertyOptional({ description: 'Expedia email associated with the account' })
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

  @ApiPropertyOptional({ description: 'Multiple portfolio emails', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  multiplePortfolioEmails?: string[]

  @ApiPropertyOptional({ description: 'Case contact email' })
  @IsString()
  @IsOptional()
  case_contact_email?: string

  @ApiPropertyOptional({ description: 'Case contact name' })
  @IsString()
  @IsOptional()
  case_contact_name?: string

  @ApiPropertyOptional({ description: 'Case contact phone' })
  @IsString()
  @IsOptional()
  case_contact_phone?: string

  @ApiPropertyOptional({ description: 'Reporting contact name' })
  @IsString()
  @IsOptional()
  reporting_contact_name?: string

  @ApiPropertyOptional({ description: 'Reporting contact email' })
  @IsString()
  @IsOptional()
  reporting_contact_email?: string

  @ApiPropertyOptional({ description: 'Reporting contact phone' })
  @IsString()
  @IsOptional()
  reporting_contact_phone?: string

  @ApiProperty({ description: 'Property ID' })
  @IsString()
  @IsNotEmpty()
  property_id: string
}

export class UpdatePropertyCredentialsDto extends PartialType(CreatePropertyCredentialsDto) {}

export class BulkUpdatePropertyCredentialsDto {
  @ApiProperty({
    description: 'Array of property IDs to apply credentials to',
    type: [String],
    example: ['property-1', 'property-2', 'property-3']
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  propertyIds: string[]

  @ApiProperty({
    description: 'Credentials to apply to all properties',
    type: UpdatePropertyCredentialsDto
  })
  credentials: UpdatePropertyCredentialsDto
}
