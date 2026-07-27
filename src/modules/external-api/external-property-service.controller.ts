import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
import { Public } from '../auth/decorators/public.decorator'
import { ExternalPropertyService } from './external-property.service'

@ApiTags('External API - Property')
@Public()
@Controller('external/property')
export class ExternalPropertyServiceController {
  constructor(
    private readonly externalPropertyService: ExternalPropertyService
  ) {}

  @Get(':propertyId/credentials/unmasked')
  @UseGuards(ExternalJwtGuard)
  @ApiBearerAuth('external-jwt')
  @ApiOperation({
    summary: 'Get unmasked credentials by property ID (Dashboard external auth)',
    description:
      'Returns decrypted credentials for the given property. Intended for service-to-service ' +
      'calls from the Dashboard backend. Authenticate with a communication JWT obtained from ' +
      'POST /external-auth/generate-token.'
  })
  @ApiResponse({
    status: 200,
    description: 'Returns property credentials with decrypted passwords'
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing communication JWT' })
  @ApiResponse({ status: 404, description: 'No credentials found for this property' })
  getCredentialsUnmasked(@Param('propertyId') propertyId: string) {
    return this.externalPropertyService.getCredentialsUnmaskedByPropertyId(
      propertyId
    )
  }
}
