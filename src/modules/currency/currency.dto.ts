import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateCurrencyDto {
  @ApiProperty({
    example: 'USD',
    description: 'Currency code (ISO 4217)'
  })
  @IsString()
  @IsNotEmpty()
  code: string

  @ApiProperty({
    example: 'United States Dollar',
    description: 'Currency name'
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiPropertyOptional({
    example: '$',
    description: 'Currency symbol'
  })
  @IsString()
  @IsOptional()
  symbol?: string

  @ApiProperty({ example: true, description: 'Whether currency is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateCurrencyDto extends PartialType(CreateCurrencyDto) {}

export class ReorderCurrencyDto {
  @ApiProperty({
    example: 2,
    description: 'New order position for the currency'
  })
  @IsNotEmpty()
  newOrder: number
}

export class DeleteCurrencyDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification (required for deletion)'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}
