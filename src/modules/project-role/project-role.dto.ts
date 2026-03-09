import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'

export class CreateProjectRoleDto {
  @ApiProperty({
    enum: ProjectType,
    example: ProjectType.DASHBOARD,
    description: 'Project type (DBMS, DASHBOARD, or PARSER)'
  })
  @IsEnum(ProjectType)
  @IsNotEmpty()
  project_type!: ProjectType

  @ApiProperty({
    example: 'Dashboard Admin',
    description: 'Name of the project role'
  })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiPropertyOptional({
    example: 'Administrator access for Dashboard project with full permissions',
    description: 'Description of the project role'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'MongoDB ObjectId of the base user role'
  })
  @IsMongoId()
  @IsNotEmpty()
  base_user_role_id!: string

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the project role is active',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class UpdateProjectRoleDto {
  @ApiPropertyOptional({
    example: 'Dashboard Viewer',
    description: 'Name of the project role'
  })
  @IsString()
  @IsOptional()
  name?: string

  @ApiPropertyOptional({
    example: 'Read-only access for Dashboard project',
    description: 'Description of the project role'
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439012',
    description: 'MongoDB ObjectId of the base user role'
  })
  @IsMongoId()
  @IsOptional()
  base_user_role_id?: string

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the project role is active'
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}
