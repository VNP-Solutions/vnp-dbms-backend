import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class CreateUserDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'User role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  first_name: string

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  last_name: string

  @ApiProperty({ example: 'en', description: 'Preferred language code' })
  @IsString()
  @IsNotEmpty()
  language: string

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job title'
  })
  @IsString()
  @IsOptional()
  job_title?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number'
  })
  @IsString()
  @IsOptional()
  phone_number?: string
}

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'newuser@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsOptional()
  email?: string

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsString()
  @IsOptional()
  first_name?: string

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  last_name?: string

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code'
  })
  @IsString()
  @IsOptional()
  language?: string

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User display image URL'
  })
  @IsString()
  @IsOptional()
  display_image?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number'
  })
  @IsString()
  @IsOptional()
  contact_number?: string

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job title'
  })
  @IsString()
  @IsOptional()
  job_title?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number'
  })
  @IsString()
  @IsOptional()
  phone_number?: string
}

export class UpdateOwnProfileDto {
  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsString()
  @IsOptional()
  first_name?: string

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  last_name?: string

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code'
  })
  @IsString()
  @IsOptional()
  language?: string

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'User display image URL'
  })
  @IsString()
  @IsOptional()
  display_image?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact phone number'
  })
  @IsString()
  @IsOptional()
  contact_number?: string

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job title'
  })
  @IsString()
  @IsOptional()
  job_title?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number'
  })
  @IsString()
  @IsOptional()
  phone_number?: string
}

export class AssignUserRoleDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'New user role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string
}

export class ManageUserAccessDto {
  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of portfolio IDs to add/revoke'
  })
  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    description: 'Array of property IDs to add/revoke'
  })
  @IsArray()
  @IsOptional()
  property_ids?: string[]
}

export class UserQueryDto extends QueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user role ID (can be comma-separated for multiple)',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  user_role_id?: string

  @ApiPropertyOptional({
    description: 'Filter by verified status (true/false/All)',
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
  is_verified?: boolean

  @ApiPropertyOptional({
    description: 'Filter by creation date from (YYYY-MM-DD format)',
    example: '2024-01-01'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created_from?: Date

  @ApiPropertyOptional({
    description: 'Filter by creation date to (YYYY-MM-DD format)',
    example: '2024-12-31'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  created_to?: Date

  @ApiPropertyOptional({
    description: 'Filter by update date from (YYYY-MM-DD format)',
    example: '2024-01-01'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updated_from?: Date

  @ApiPropertyOptional({
    description: 'Filter by update date to (YYYY-MM-DD format)',
    example: '2024-12-31'
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  updated_to?: Date
}

export class DeleteUserDto {
  @ApiProperty({
    example: 'Password@123',
    description: 'Current user password for verification'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}
