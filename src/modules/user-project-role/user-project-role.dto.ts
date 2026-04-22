import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional
} from 'class-validator'

export class CreateUserProjectRoleDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'MongoDB ObjectId of the user'
  })
  @IsMongoId()
  @IsNotEmpty()
  user_id!: string

  @ApiProperty({
    enum: ProjectType,
    example: ProjectType.DASHBOARD,
    description: 'Project type (DBMS, DASHBOARD, or PARSER)'
  })
  @IsEnum(ProjectType)
  @IsNotEmpty()
  project_type!: ProjectType

  @ApiProperty({
    example: '507f1f77bcf86cd799439012',
    description: 'MongoDB ObjectId of the user role to assign'
  })
  @IsMongoId()
  @IsNotEmpty()
  user_role_id!: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014'],
    description: 'Array of portfolio IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439015', '507f1f77bcf86cd799439016'],
    description: 'Array of subportfolio IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439017', '507f1f77bcf86cd799439018'],
    description: 'Array of property IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  property_ids?: string[]

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user project role is active',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class UpdateUserProjectRoleDto {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439019',
    description: 'MongoDB ObjectId of the user role'
  })
  @IsMongoId()
  @IsOptional()
  user_role_id?: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439020', '507f1f77bcf86cd799439021'],
    description: 'Array of portfolio IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439022', '507f1f77bcf86cd799439023'],
    description: 'Array of subportfolio IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439024', '507f1f77bcf86cd799439025'],
    description: 'Array of property IDs the user can access'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  property_ids?: string[]

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the user project role is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class AssignProjectRoleDto {
  @ApiProperty({
    example: '507f1f77bcf86cd799439026',
    description: 'MongoDB ObjectId of the user to assign the project role'
  })
  @IsMongoId()
  @IsNotEmpty()
  user_id!: string

  @ApiProperty({
    enum: ProjectType,
    example: ProjectType.PARSER,
    description: 'Project type (DBMS, DASHBOARD, or PARSER)'
  })
  @IsEnum(ProjectType)
  @IsNotEmpty()
  project_type!: ProjectType

  @ApiProperty({
    example: '507f1f77bcf86cd799439027',
    description: 'MongoDB ObjectId of the user role to assign'
  })
  @IsMongoId()
  @IsNotEmpty()
  user_role_id!: string

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439028', '507f1f77bcf86cd799439029'],
    description: 'Array of portfolio IDs the user can access (optional)'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439030', '507f1f77bcf86cd799439031'],
    description: 'Array of subportfolio IDs the user can access (optional)'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  subportfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439032', '507f1f77bcf86cd799439033'],
    description: 'Array of property IDs the user can access (optional)'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  property_ids?: string[]
}

export class GetUserProjectRolesQueryDto {
  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439034',
    description: 'Filter by user ID'
  })
  @IsMongoId()
  @IsOptional()
  user_id?: string

  @ApiPropertyOptional({
    enum: ProjectType,
    example: ProjectType.DASHBOARD,
    description: 'Filter by project type'
  })
  @IsEnum(ProjectType)
  @IsOptional()
  project_type?: ProjectType

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class ManageUserProjectRoleAccessDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439035', '507f1f77bcf86cd799439036'],
    description: 'Array of portfolio IDs to add/revoke'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    type: [String],
    example: ['507f1f77bcf86cd799439037', '507f1f77bcf86cd799439038'],
    description: 'Array of property IDs to add/revoke'
  })
  @IsArray()
  @IsMongoId({ each: true })
  @IsOptional()
  property_ids?: string[]
}
