import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateSubportfolioDto {
  @ApiProperty({ example: 'West Region', description: 'Subportfolio name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ example: 'Properties in the west region', description: 'Description' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Portfolio ID' })
  @IsString()
  @IsNotEmpty()
  portfolio_id: string
}

export class UpdateSubportfolioDto extends PartialType(CreateSubportfolioDto) {}

export class SubportfolioQueryDto extends QueryDto {
  @ApiPropertyOptional({ description: 'Filter by portfolio ID', example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({ description: 'Start date for created_at filter (ISO)' })
  @IsOptional()
  @IsString()
  start_date?: string

  @ApiPropertyOptional({ description: 'End date for created_at filter (ISO)' })
  @IsOptional()
  @IsString()
  end_date?: string

  @ApiPropertyOptional({ description: 'Filter by access lost status', example: false })
  @IsOptional()
  @IsBoolean()
  access_lost?: boolean
}
