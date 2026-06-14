import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreateBillingTypeDto {
  @ApiProperty({ example: 'EBS', description: 'Billing type name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: true, description: 'Whether billing type is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateBillingTypeDto extends PartialType(CreateBillingTypeDto) {}

export class ReorderBillingTypeDto {
  @ApiProperty({ example: 2, description: 'New order position for the billing type' })
  @IsNumber()
  @IsNotEmpty()
  newOrder: number
}

export class DeleteBillingTypeDto {
  @ApiProperty({ example: 'MySecureP@ssw0rd', description: 'User password for verification (required for deletion)' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the billing type to transfer all associated properties to before deletion' })
  @IsString()
  @IsNotEmpty()
  replacementId: string
}
