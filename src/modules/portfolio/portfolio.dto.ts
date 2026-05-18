import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'
import { Transform } from 'class-transformer'

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Luxury Hotels Portfolio', description: 'Portfolio name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'OTA', description: 'Service type name' })
  @IsString()
  @IsNotEmpty()
  service_type: string

  @ApiProperty({ example: true, description: 'Whether portfolio is active' })
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

  @ApiPropertyOptional({ example: true, description: 'Whether contract has been signed' })
  @IsBoolean()
  @IsOptional()
  contract_signed?: boolean
}

export class UpdatePortfolioDto extends PartialType(CreatePortfolioDto) {}

export class PortfolioQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by service type', example: 'OTA' })
  @IsOptional()
  @IsString()
  service_type?: string

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
