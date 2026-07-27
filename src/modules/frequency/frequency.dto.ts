import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator'

export class CreateFrequencyDto {
  @ApiProperty({ example: 'REGULAR', description: 'Frequency name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: true, description: 'Whether frequency is active' })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}

export class UpdateFrequencyDto extends PartialType(CreateFrequencyDto) {}

export class ReorderFrequencyDto {
  @ApiProperty({ example: 2, description: 'New order position for the frequency' })
  @IsNumber()
  @IsNotEmpty()
  newOrder: number
}

export class DeleteFrequencyDto {
  @ApiProperty({ example: 'MySecureP@ssw0rd', description: 'User password for verification (required for deletion)' })
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'ID of the frequency to transfer all associated properties to before deletion' })
  @IsString()
  @IsNotEmpty()
  replacementId: string
}
