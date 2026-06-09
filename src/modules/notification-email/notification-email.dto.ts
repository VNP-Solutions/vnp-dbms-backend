import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNotEmpty } from 'class-validator'

export class UpdateNotificationEmailDto {
  @ApiProperty({ example: true, description: 'Whether email notifications are enabled globally' })
  @IsBoolean()
  @IsNotEmpty()
  is_active: boolean
}
