import { ApiProperty } from '@nestjs/swagger'

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
