import { OmitType, PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreatePortfolioDto {
  @ApiProperty({ example: 'Luxury Hotels Portfolio', description: 'Portfolio name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Service type ID' })
  @IsString()
  @IsNotEmpty()
  service_type_id: string

  @ApiProperty({ example: '507f1f77bcf86cd799439020', description: 'Currency ID' })
  @IsString()
  @IsNotEmpty()
  currency_id: string

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

  @ApiPropertyOptional({ example: 'John Doe', description: 'Sales agent (required if commissionable)' })
  @ValidateIf((o) => o.is_commissionable === true)
  @IsNotEmpty({ message: 'Sales agent is required when portfolio is commissionable' })
  @IsString()
  @IsOptional()
  sales_agent?: string

  @ApiPropertyOptional({ example: 'access@example.com', description: 'Access email' })
  @IsString()
  @IsEmail()
  @IsOptional()
  access_email?: string

  @ApiPropertyOptional({ example: '+1234567890', description: 'Access phone' })
  @IsString()
  @IsOptional()
  access_phone?: string
}

export class UpdatePortfolioDto extends PartialType(OmitType(CreatePortfolioDto, ['is_active'] as const)) {}

export class PortfolioQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by service type ID', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  service_type_id?: string

  @ApiPropertyOptional({ description: 'Filter by active status (true/false/all)', example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean

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
  access_lost?: boolean
}
