import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
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
}
