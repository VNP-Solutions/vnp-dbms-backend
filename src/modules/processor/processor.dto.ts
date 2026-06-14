import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreateProcessorDto {
  @ApiProperty({ example: 'QuantumPay', description: 'Processor name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: true, description: 'Whether processor is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateProcessorDto extends PartialType(CreateProcessorDto) {}

export class ReorderProcessorDto {
  @ApiProperty({ example: 2, description: 'New order position for the processor' })
  @IsNumber()
  @IsNotEmpty()
  newOrder: number
}

export class DeleteProcessorDto {
  @ApiProperty({ example: 'MySecureP@ssw0rd', description: 'User password for verification (required for deletion)' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the processor to transfer all associated properties to before deletion' })
  @IsString()
  @IsNotEmpty()
  replacementId: string
}
