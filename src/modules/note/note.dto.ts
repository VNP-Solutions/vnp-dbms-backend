import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator'

export enum NoteEntityType {
  ALL = 'all',
  PORTFOLIO = 'portfolio',
  PROPERTY = 'property'
}

export class CreateNoteDto {
  @ApiProperty({
    example: 'Remember to update property credentials',
    description: 'Note text content'
  })
  @IsString()
  @IsNotEmpty()
  text: string

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the note is marked as done',
    default: false
  })
  @IsBoolean()
  @IsOptional()
  is_done?: boolean

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Portfolio ID this note belongs to'
  })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439012',
    description: 'Property ID this note belongs to'
  })
  @IsString()
  @IsOptional()
  property_id?: string
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

export class NoteQueryDto {
  @ApiPropertyOptional({
    description: 'Search by note text, portfolio name, or property name',
    example: 'credentials'
  })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({
    description: 'Filter by portfolio ID',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Filter by entity type (portfolio, property). Returns all notes for that entity type.',
    example: 'portfolio',
    enum: NoteEntityType
  })
  @IsOptional()
  @IsEnum(NoteEntityType)
  entity_type?: NoteEntityType

  @ApiPropertyOptional({
    description: 'Filter by done status (true/false)',
    example: 'false'
  })
  @IsOptional()
  @IsString()
  is_done?: string

  @ApiPropertyOptional({
    description: 'Sort order (asc/desc)',
    example: 'desc',
    default: 'desc'
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc'
}

export class BulkDeleteNotesDto {
  @ApiProperty({
    description: 'Array of note IDs to delete',
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    type: [String]
  })
  @IsArray()
  @IsMongoId({ each: true })
  ids: string[]
}

export class DeleteAllNotesDto {
  @ApiPropertyOptional({
    description: 'Portfolio ID to filter notes for deletion',
    example: '507f1f77bcf86cd799439011'
  })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({
    description: 'Property ID to filter notes for deletion',
    example: '507f1f77bcf86cd799439012'
  })
  @IsOptional()
  @IsString()
  property_id?: string

  @ApiPropertyOptional({
    description: 'Done status to filter notes for deletion (true/false)',
    example: 'true'
  })
  @IsOptional()
  @IsString()
  is_done?: string
}
