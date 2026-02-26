import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested
} from 'class-validator'
import { Type } from 'class-transformer'

export class AttachmentUrlDto {
  @ApiProperty({
    example: 'https://s3.amazonaws.com/bucket/document.pdf',
    description: 'URL of the file to attach'
  })
  @IsUrl()
  @IsNotEmpty()
  url: string

  @ApiPropertyOptional({
    example: 'report.pdf',
    description:
      'Optional custom filename for the attachment (if not provided, will extract from URL)'
  })
  @IsString()
  @IsOptional()
  filename?: string
}

export class SendEmailDto {
  @ApiProperty({
    example: ['recipient@example.com', 'another@example.com'],
    description: 'Array of recipient email addresses',
    type: [String]
  })
  @IsArray()
  @IsEmail({}, { each: true })
  @IsNotEmpty({ each: true })
  to: string[]

  @ApiProperty({
    example: 'Important Update',
    description: 'Email subject'
  })
  @IsString()
  @IsNotEmpty()
  subject: string

  @ApiProperty({
    example: 'Dear recipient,\n\nThis is an important update...',
    description: 'Email body content (plain text)'
  })
  @IsString()
  @IsNotEmpty()
  body: string

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether to include sender information at the end of the email body (defaults to true)'
  })
  @IsBoolean()
  @IsOptional()
  send_sender_data?: boolean

  @ApiPropertyOptional({
    type: [AttachmentUrlDto],
    example: [
      {
        url: 'https://s3.amazonaws.com/bucket/report.pdf',
        filename: 'monthly-report.pdf'
      }
    ],
    description: 'Optional array of file URLs to attach to the email'
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentUrlDto)
  @IsOptional()
  attachment_urls?: AttachmentUrlDto[]
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}
