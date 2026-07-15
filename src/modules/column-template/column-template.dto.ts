import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsArray, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateColumnTemplateDto {
  @ApiProperty({ example: 'My Custom Template', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: ['column_a', 'column_b', 'column_c'],
    description: 'List of column names',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  column_list: string[]

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'User ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  user_id: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Role ID (MongoDB ObjectId) to assign this template to as the role\'s default column layout'
  })
  @IsMongoId()
  @IsOptional()
  role_id?: string
}

export class UpdateColumnTemplateDto extends PartialType(CreateColumnTemplateDto) {}
