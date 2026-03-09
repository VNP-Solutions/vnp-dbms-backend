import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InvitationRoleEnum, InvitationStatus, ProjectType } from '@prisma/client'
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'

export class ProjectRoleInvitationDto {
  @ApiProperty({
    enum: ProjectType,
    example: ProjectType.DASHBOARD,
    description: 'Project type for this role assignment'
  })
  @IsEnum(ProjectType)
  @IsNotEmpty()
  project_type: ProjectType

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'ID of the user role to assign for this project'
  })
  @IsMongoId()
  @IsNotEmpty()
  user_role_id: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439011'],
    description: 'Array of portfolio IDs for this project (optional)'
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439013'],
    description: 'Array of subportfolio IDs for this project (optional)'
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439015'],
    description: 'Array of property IDs for this project (optional)'
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  property_ids?: string[]
}

export class CreateInvitationDto {
  @ApiProperty({
    example: 'john@example.com',
    description: 'Email address of the user to invite'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description:
      'ID of the user role to assign when the invitation is accepted (for DBMS project)'
  })
  @IsString()
  @IsNotEmpty()
  user_role_id: string

  @ApiPropertyOptional({
    example: 'Welcome to the VNP dashboard!',
    description: 'Optional message to include in the invitation email'
  })
  @IsOptional()
  @IsString()
  message?: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description:
      'Array of portfolio IDs the user should have access to (optional, for DBMS project)'
  })
  @IsOptional()
  @IsArray()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    description:
      'Array of subportfolio IDs the user should have access to (optional, for DBMS project)'
  })
  @IsOptional()
  @IsArray()
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'],
    description:
      'Array of property IDs the user should have access to (optional, for DBMS project)'
  })
  @IsOptional()
  @IsArray()
  property_ids?: string[]

  @ApiPropertyOptional({
    enum: InvitationRoleEnum,
    example: InvitationRoleEnum.partial,
    description:
      'High-level invitation role type (admin or partial). Defaults to partial.'
  })
  @IsOptional()
  @IsEnum(InvitationRoleEnum)
  role?: InvitationRoleEnum

  @ApiPropertyOptional({
    type: [ProjectRoleInvitationDto],
    description: 'Project-specific role assignments (optional, for DASHBOARD and PARSER projects)'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectRoleInvitationDto)
  project_roles?: ProjectRoleInvitationDto[]
}

export class AcceptInvitationDto {
  @ApiProperty({
    example: 'John',
    description: 'First name of the user accepting the invitation'
  })
  @IsString()
  @IsNotEmpty()
  first_name: string

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user accepting the invitation'
  })
  @IsString()
  @IsNotEmpty()
  last_name: string

  @ApiProperty({
    example: 'Password123!',
    description:
      'Password for the new user account (8-32 chars, must contain letter, number, special char)'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  password: string

  @ApiPropertyOptional({
    example: 'en',
    description: 'Preferred language code'
  })
  @IsOptional()
  @IsString()
  language?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Contact number of the user'
  })
  @IsOptional()
  @IsString()
  contact_number?: string
}

export class UpdateInvitationDto {
  @ApiPropertyOptional({
    enum: InvitationStatus,
    example: InvitationStatus.Cancelled,
    description: 'Status of the invitation'
  })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus

  @ApiPropertyOptional({
    enum: InvitationRoleEnum,
    example: InvitationRoleEnum.admin,
    description:
      'Invitation role type. If changed, it only affects classification and not the underlying user role.'
  })
  @IsOptional()
  @IsEnum(InvitationRoleEnum)
  role?: InvitationRoleEnum

  @ApiPropertyOptional({
    example: 'Updated invitation message',
    description: 'Message to include in the invitation email'
  })
  @IsOptional()
  @IsString()
  message?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description:
      'Updated user role ID to assign when the invitation is accepted'
  })
  @IsOptional()
  @IsString()
  user_role_id?: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description:
      'Updated portfolio IDs the user should have access to (optional)'
  })
  @IsOptional()
  @IsArray()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    description:
      'Updated subportfolio IDs the user should have access to (optional)'
  })
  @IsOptional()
  @IsArray()
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'],
    description:
      'Updated property IDs the user should have access to (optional)'
  })
  @IsOptional()
  @IsArray()
  property_ids?: string[]
}

export class ResendInvitationDto {
  @ApiPropertyOptional({
    example: 'We hope you can join our team soon!',
    description: 'Updated message for the resent invitation'
  })
  @IsOptional()
  @IsString()
  message?: string
}

