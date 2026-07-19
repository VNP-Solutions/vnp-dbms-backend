import { PartialType } from '@nestjs/mapped-types'
import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsMongoId, IsNotEmpty, IsString } from 'class-validator'

export class CreateColumnTemplateDto {
  @ApiProperty({ example: 'My Custom Template', description: 'Template name' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    example: [
      'name', 'portfolio_id', 'subportfolio_id', 'service_type', 'property_identifier',
      'currency', 'hotel_address', 'sales_rep',
      'discontinued_email_ids', 'cybersource_mid', 'adyen_location', 'stripe_connected_email',
      'notes',
      'expedia_id', 'booking_id', 'agoda_id'
    ],
    description: 'List of column identifiers to include in the property view. Valid values map to property fields defined in the column filter utility.',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  column_list: string[]

  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'User ID (MongoDB ObjectId)' })
  @IsMongoId()
  @IsNotEmpty()
  user_id: string
}

export class UpdateColumnTemplateDto extends PartialType(CreateColumnTemplateDto) {}
