import { OmitType, PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePropertyDto {
  @ApiProperty({ example: 'Grand Hotel', description: 'Property name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: '123 Main Street, New York, NY 10001', description: 'Property address' })
  @IsString()
  @IsNotEmpty()
  address: string

  @ApiProperty({ example: '507f1f77bcf86cd799439020', description: 'Currency ID' })
  @IsString()
  @IsNotEmpty()
  currency_id: string

  @ApiPropertyOptional({ example: 'GRAND HOTEL NY', description: 'Card descriptor' })
  @IsString()
  @IsOptional()
  card_descriptor?: string

  @ApiPropertyOptional({ example: true, description: 'Whether property is active' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.000Z', description: 'Next due date' })
  @IsDateString()
  @IsOptional()
  next_due_date?: string

  @ApiProperty({ example: '507f1f77bcf86cd799439012', description: 'Portfolio ID' })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439014', description: 'Subportfolio ID' })
  @IsString()
  @IsOptional()
  subportfolio_id?: string

  @ApiPropertyOptional({ description: 'Previous portfolio ID (tracking)' })
  @IsString()
  @IsOptional()
  previous_portfolio_id?: string

  @ApiPropertyOptional({ description: 'Portfolio IDs where property is visible', type: [String] })
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

  @ApiPropertyOptional({ description: 'Webmail password' })
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
}

export class UpdatePropertyDto extends PartialType(OmitType(CreatePropertyDto, ['is_active'] as const)) {
  @ApiPropertyOptional({ description: 'Set is_active (use activate/deactivate endpoints if needed)' })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class PropertyQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by portfolio ID', example: '507f1f77bcf86cd799439012' })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({ description: 'Filter by subportfolio ID', example: '507f1f77bcf86cd799439014' })
  @IsOptional()
  @IsString()
  subportfolio_id?: string

  @ApiPropertyOptional({ description: 'Filter by active status (true/false/all)', example: 'true' })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({ description: 'Filter by currency ID' })
  @IsOptional()
  @IsString()
  currency_id?: string

  @ApiPropertyOptional({ description: 'Start date for created_at filter (ISO)' })
  @IsOptional()
  @IsString()
  start_date?: string

  @ApiPropertyOptional({ description: 'End date for created_at filter (ISO)' })
  @IsOptional()
  @IsString()
  end_date?: string
}
