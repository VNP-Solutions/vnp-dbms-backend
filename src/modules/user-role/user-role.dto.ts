import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator'
import { AccessLevel, PermissionLevel } from '../../common/interfaces/permission.interface'

export class PermissionDto {
  @ApiProperty({ enum: PermissionLevel, example: PermissionLevel.all })
  @IsEnum(PermissionLevel)
  @IsNotEmpty()
  permission_level: PermissionLevel

  @ApiProperty({ enum: AccessLevel, example: AccessLevel.all })
  @IsEnum(AccessLevel)
  @IsNotEmpty()
  access_level: AccessLevel
}

export class CreateUserRoleDto {
  @ApiProperty({ example: 'Super Admin', description: 'Role name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: 'Full system access with all permissions',
    description: 'Role description'
  })
  @IsString()
  @IsNotEmpty()
  description: string

  @ApiProperty({
    example: false,
    description: 'Whether the role is for external users'
  })
  @IsBoolean()
  @IsNotEmpty()
  is_external: boolean

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the role can access global reports',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  can_access_mis?: boolean

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the role is active',
    default: true
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean

  @ApiPropertyOptional({ type: PermissionDto, description: 'Portfolio permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  portfolio_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'Property permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  property_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'Audit permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  audit_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'User permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  user_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'System settings permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  system_settings_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'Bank details permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  bank_details_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'User roles (role templates) permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  roles_permission?: PermissionDto

  @ApiPropertyOptional({ type: PermissionDto, description: 'Access logs permission' })
  @IsObject()
  @ValidateNested()
  @Type(() => PermissionDto)
  @IsOptional()
  access_logs_permission?: PermissionDto

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description:
      'User column template ID to copy column_list from when creating this role\'s column template'
  })
  @IsMongoId()
  @IsOptional()
  user_column_template_id?: string
}

export class UpdateUserRoleDto extends PartialType(CreateUserRoleDto) {}

export class ReorderUserRoleDto {
  @ApiProperty({
    example: 2,
    description: 'New order position for the role'
  })
  @IsNotEmpty()
  newOrder: number
}

export class DeleteUserRoleDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification (required for deletion)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}
