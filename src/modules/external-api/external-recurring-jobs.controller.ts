import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { DbmsPreCheckDto } from './external-api.dto'
import { ExternalRecurringJobsService } from './external-recurring-jobs.service'

@ApiTags('External API - Recurring Jobs')
@ApiBearerAuth('JWT-auth')
@Controller('external/recurring-jobs')
@UseGuards(JwtAuthGuard)
export class ExternalRecurringJobsController {
  constructor(
    private readonly externalRecurringJobsService: ExternalRecurringJobsService
  ) {}

  @Post('dbms-pre-check')
  @ApiOperation({
    summary: 'Pre-check recurring job creation (DBMS → Scraper bridge)',
    description:
      'Validates the payload, strips billing_type, then forwards the request to the scraper backend ' +
      '(POST /recurring-jobs/dbms-ingest) and relays the response verbatim. ' +
      '200 = scraper accepted the payload and is processing; ' +
      '400 = one or more properties failed the scraper pre-check (response body contains expedia_ids and descriptions); ' +
      '502 = scraper backend is unreachable or not configured.'
  })
  @ApiBody({ type: DbmsPreCheckDto })
  @ApiResponse({
    status: 200,
    description: 'Pre-check passed — scraper backend accepted the payload',
    schema: {
      example: { message: 'Processing', data: null }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'One or more properties failed the scraper pre-check',
    schema: {
      example: {
        message: 'Some properties could not be processed',
        data: {
          expedia_ids: [12345],
          descriptions: [
            { name: 'Hotel Grandeur', error_message: 'Duplicate recurring job' }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 502,
    description: 'Scraper backend is unreachable or not configured'
  })
  async dbmsPreCheck(
    @Body() dto: DbmsPreCheckDto,
    @Res() res: Response
  ): Promise<void> {
    const result = await this.externalRecurringJobsService.dbmsPreCheck(dto)
    res.status(result.status).json(result.body)
  }
}
