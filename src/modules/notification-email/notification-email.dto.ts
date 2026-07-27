import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsNotEmpty } from 'class-validator'

export class UpdateNotificationEmailDto {
  @ApiProperty({ example: true, description: 'Whether email notifications are enabled globally' })
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}
