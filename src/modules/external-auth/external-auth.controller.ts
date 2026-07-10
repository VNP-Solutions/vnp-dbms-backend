import { Controller, Logger, Post, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { ResponseHandler } from '../../common/utils/response-handler.util'
import { Public } from '../auth/decorators/public.decorator'
import { ExternalAuthService } from './external-auth.service'
import { GenerateCommunicationTokenApiResponseDto } from './external-auth.dto'
import { ExternalRawSecretGuard } from './guards/external-raw-secret.guard'

@ApiTags('External Auth')
@Controller('external-auth')
export class ExternalAuthController {
  private readonly logger = new Logger(ExternalAuthController.name)

  constructor(private readonly externalAuthService: ExternalAuthService) {}

  @Post('generate-token')
  @Public()
  @UseGuards(ExternalRawSecretGuard)
  @ApiBearerAuth('communication-secret')
  @ApiOperation({
    summary: 'Generate external communication JWT',
    description:
      'Exchange the raw JWT_COMMUNICATION_SECRET for a signed communication JWT (type: external-communication). Same pattern as vnp-scraper-backend qa-panel generate-token endpoint.'
  })
  @ApiResponse({
    status: 200,
    description: 'Communication token generated successfully',
    type: GenerateCommunicationTokenApiResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid communication secret' })
  async generateToken(@Res() response: Response) {
    return ResponseHandler.handler(
      response,
      // eslint-disable-next-line @typescript-eslint/require-await
      async () => {
        const result = this.externalAuthService.generateCommunicationToken()
        return {
          statusCode: 200,
          message: 'Communication token generated successfully',
          data: result
        }
      },
      this.logger
    )
  }
}
