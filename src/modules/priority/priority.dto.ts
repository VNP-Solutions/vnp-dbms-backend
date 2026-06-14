import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreatePriorityDto {
  @ApiProperty({ example: 'High', description: 'Priority name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: true, description: 'Whether priority is active' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdatePriorityDto extends PartialType(CreatePriorityDto) {}

export class ReorderPriorityDto {
  @ApiProperty({ example: 2, description: 'New order position for the priority' })
  @IsNumber()
  @IsNotEmpty()
  newOrder: number
}

export class DeletePriorityDto {
  @ApiProperty({ example: 'MySecureP@ssw0rd', description: 'User password for verification (required for deletion)' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the priority to transfer all associated properties to before deletion' })
  @IsString()
  @IsNotEmpty()
  replacementId: string
}
