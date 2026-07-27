import { ApiProperty } from '@nestjs/swagger'
import { PartialType } from '@nestjs/mapped-types'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator'
import { QueryDto } from '../../common/dto/query.dto'

export class FileUploadResponseDto {
  @ApiProperty({
    description: 'The public URL of the uploaded file',
    example: 'https://bucket-name.s3.region.amazonaws.com/uploads/filename.jpg'
  })
  url: string

  @ApiProperty({
    description: 'The S3 key of the uploaded file',
    example: 'uploads/1234567890-filename.jpg'
  })
  key: string

  @ApiProperty({
    description: 'Original file name',
    example: 'document.pdf'
  })
  originalName: string

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000
  })
  size: number

  @ApiProperty({
    description: 'File MIME type',
    example: 'image/jpeg'
  })
  mimetype: string
}

export class BulkFileUploadResponseDto {
  @ApiProperty({
    description: 'Array of uploaded file URLs and metadata',
    type: [FileUploadResponseDto]
  })
  files: FileUploadResponseDto[]

  @ApiProperty({
    description: 'Total number of files uploaded',
    example: 5
  })
  totalFiles: number

  @ApiProperty({
    description: 'Number of successful uploads',
    example: 5
  })
  successfulUploads: number

  @ApiProperty({
    description: 'Number of failed uploads',
    example: 0
  })
  failedUploads: number

  @ApiProperty({
    description: 'Error messages for failed uploads',
    example: [],
    type: [String],
    required: false
  })
  errors?: string[]
}

export class CreateFileDto {
  @ApiProperty({
    example: 'https://bucket-name.s3.region.amazonaws.com/uploads/contract.pdf',
    description: 'S3 URL returned from POST /file-upload'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string

  @ApiProperty({ example: 'Master Service Agreement 2024.pdf' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({ example: 'Signed portfolio contract' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  portfolio_id?: string

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean
}

export class UpdateFileDto extends PartialType(CreateFileDto) {}

export class FileQueryDto extends QueryDto {
  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  portfolio_id?: string

  @ApiPropertyOptional({ example: 'true' })
  @IsOptional()
  @IsString()
  is_active?: string

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  uploaded_by?: string
}

export class UploadAndCreateFileDto {
  @ApiPropertyOptional({ example: 'Signed portfolio contract' })
  @IsString()
  @IsOptional()
  description?: string

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsOptional()
  portfolio_id?: string
}