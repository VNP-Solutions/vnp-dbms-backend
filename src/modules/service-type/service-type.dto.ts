import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator'

export class CreateServiceTypeDto {
  @ApiProperty({
    example: 'OTA',
    description: 'Service type name'
  })
  @IsString()
  @IsNotEmpty()
  type: string

  @ApiProperty({
    example: true,
    description: 'Whether service type is active'
  })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateServiceTypeDto extends PartialType(CreateServiceTypeDto) {}

export class ReorderServiceTypeDto {
  @ApiProperty({
    example: 2,
    description: 'New order position for the service type'
  })
  @IsNotEmpty()
  newOrder: number
}

export class DeleteServiceTypeDto {
  @ApiProperty({
    example: 'MySecureP@ssw0rd',
    description: 'User password for verification (required for deletion)'
  })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'ID of the service type to transfer all associated portfolios and properties to before deletion'
  })
  @IsString()
  @IsNotEmpty()
  replacementId: string
}
