import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsMongoId, IsNotEmpty, IsString } from 'class-validator'

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
}

export class UpdateColumnTemplateDto extends PartialType(CreateColumnTemplateDto) {}
