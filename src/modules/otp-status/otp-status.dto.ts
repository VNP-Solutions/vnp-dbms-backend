import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OtpPlatform, OtpStatusValue } from '@prisma/client'
import { IsEnum, IsOptional, IsString } from 'class-validator'

export class CreateOtpStatusDto {
  @ApiProperty({ enum: OtpStatusValue, example: OtpStatusValue.Released })
  @IsEnum(OtpStatusValue)
  status: OtpStatusValue

  @ApiProperty({ enum: OtpPlatform, example: OtpPlatform.expedia })
  @IsEnum(OtpPlatform)
  platform: OtpPlatform

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  job_id?: string
}

export class UpdateOtpStatusDto {
  @ApiPropertyOptional({ enum: OtpStatusValue, example: OtpStatusValue.Released })
  @IsOptional()
  @IsEnum(OtpStatusValue)
  status?: OtpStatusValue

  @ApiPropertyOptional({ enum: OtpPlatform, example: OtpPlatform.expedia })
  @IsOptional()
  @IsEnum(OtpPlatform)
  platform?: OtpPlatform

  @ApiPropertyOptional({ example: '507f1f77bcf86cd799439011' })
  @IsOptional()
  @IsString()
  job_id?: string | null
}
