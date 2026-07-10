import { ApiProperty } from '@nestjs/swagger'

export class GenerateCommunicationTokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT signed with JWT_COMMUNICATION_SECRET'
  })
  token: string

  @ApiProperty({ example: '1d', description: 'Token expiry duration' })
  expiresIn: string
}

export class GenerateCommunicationTokenApiResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number

  @ApiProperty({ example: 'Communication token generated successfully' })
  message: string

  @ApiProperty({ type: GenerateCommunicationTokenResponseDto })
  data: GenerateCommunicationTokenResponseDto
}
