import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Luxury Hotels Portfolio', description: 'Portfolio name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: '507f1f77bcf86cd799439099', description: 'Service Type ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  service_type_id: string

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439100', description: 'Currency ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsOptional()
  currency_id?: string

  @ApiProperty({ example: true, description: 'Whether portfolio is active' })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean

  @ApiPropertyOptional({ example: 'contact@example.com', description: 'Contact email' })
  @IsString()
  @IsEmail()
  @IsOptional()
  contact_email?: string

  @ApiPropertyOptional({ example: 'portfolio@example.com', description: 'Portfolio contact email' })
  @IsString()
  @IsEmail()
  @IsOptional()
  portfolio_contact_email?: string

  @ApiPropertyOptional({ example: 'John Smith', description: 'Portfolio contact name' })
  @IsString()
  @IsOptional()
  portfolio_contact_name?: string

  @ApiPropertyOptional({ example: '+1234567890', description: 'Portfolio contact phone' })
  @IsString()
  @IsOptional()
  portfolio_contact_phone?: string

  @ApiProperty({ example: true, description: 'Whether portfolio is commissionable' })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsNotEmpty()
  is_commissionable: boolean

  @ApiPropertyOptional({ example: 5.5, description: 'Commission percentage or amount' })
  @IsNumber()
  @IsOptional()
  commission?: number

  @ApiPropertyOptional({ example: 'https://example.com/document.pdf', description: 'Attachment URL or path' })
  @IsString()
  @IsOptional()
  attachment?: string

  @ApiPropertyOptional({
    example: ['https://example.com/contract.pdf', 'https://example.com/sla.pdf'],
    description: 'List of attachment URLs or paths',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[]

  @ApiPropertyOptional({ example: true, description: 'Whether contract has been signed' })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  contract_signed?: boolean
}

export class UpdatePortfolioDto extends PartialType(CreatePortfolioDto) {}

export class PortfolioQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by service type ID (MongoDB ObjectId)', example: '507f1f77bcf86cd799439099' })
  @IsOptional()
  @IsMongoId()
  service_type_id?: string

  @ApiPropertyOptional({
    description: 'Filter by active status: All (both), true (active only), false (inactive only)',
    example: 'All',
    enum: ['All', 'true', 'false']
  })
  @IsOptional()
  @IsIn(['All', 'true', 'false'])
  is_active?: 'All' | 'true' | 'false'

  @ApiPropertyOptional({ description: 'Start date for created_at filter (ISO)', example: '2024-01-01' })
  @IsOptional()
  @IsString()
  start_date?: string

  @ApiPropertyOptional({ description: 'End date for created_at filter (ISO)', example: '2024-12-31' })
  @IsOptional()
  @IsString()
  end_date?: string

  @ApiPropertyOptional({ description: 'Filter by access lost status', example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === true) return true
    if (value === false) return false
    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (lower === 'true' || lower === '1') return true
      if (lower === 'false' || lower === '0') return false
    }
    return value
  })
  access_lost?: boolean
}
