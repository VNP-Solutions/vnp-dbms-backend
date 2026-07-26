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
import { Public } from '../auth/decorators/public.decorator'
import {
  BulkCreateParserJobsDto,
  DbmsPreCheckDto,
  UpdateHistoricalAndRunDateDto
} from './external-api.dto'
import { ExternalRecurringJobsService } from './external-recurring-jobs.service'

@ApiTags('External API - Recurring Jobs')
@ApiBearerAuth('JWT-auth')
@Controller('external/recurring-jobs')
@UseGuards(JwtAuthGuard)
export class ExternalRecurringJobsController {
  constructor(
    private readonly externalRecurringJobsService: ExternalRecurringJobsService
  ) {}

  // ─── DBMS Pre-Check ────────────────────────────────────────────────────────

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

  // ─── Bulk Create Parser Jobs ──────────────────────────────────────────────

  @Post('assign-parser-jobs')
  @Public()
  @ApiOperation({
    summary: 'Auto-calculate date ranges and create parser jobs (DBMS → Parser bridge)',
    description:
      'Accepts a list of DBMS property IDs and an OTA type. For each property, ' +
      'creates one job for the specified OTA type if it has both a historical "to" date and a CRS value. ' +
      'Calculates: start_date = historical_to + 1 day; ' +
      'end_date = start_date + CRS days (Booking adds +365 days). ' +
      'All generated jobs are forwarded in a single POST to the parser backend ' +
      '(POST /api/jobs/bulk-create-from-dbms). ' +
      '200 = parser backend accepted the payload; ' +
      '404 = one or more property IDs were not found; ' +
      '502 = parser backend is unreachable or not configured.'
  })
  @ApiBody({ type: BulkCreateParserJobsDto })
  @ApiResponse({
    status: 200,
    description: 'Parser backend accepted the payload',
    schema: {
      example: {
        relay: { status: 200, body: { message: 'Processing', data: null } },
        summary: [
          {
            property_id: 'prop-id-1',
            name: 'Hotel Grandeur',
            jobs_created: [
              { ota_type: 'expedia', start_date: '2025-07-01', end_date: '2025-10-01' },
              { ota_type: 'booking', start_date: '2025-07-01', end_date: '2026-10-01' }
            ],
            skipped_otas: [
              { ota_type: 'agoda', reason: 'No agoda_id configured' }
            ]
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'One or more property IDs were not found in the database'
  })
  @ApiResponse({
    status: 502,
    description: 'Parser backend is unreachable or not configured'
  })
  async bulkCreateParserJobs(
    @Body() dto: BulkCreateParserJobsDto,
    @Res() res: Response
  ): Promise<void> {
    const result =
      await this.externalRecurringJobsService.bulkCreateParserJobs(dto)
    res.status(result.relay.status).json({
      relay: result.relay,
      summary: result.summary
    })
  }

  // ─── Update Historical To + Run Date ────────────────────────────────────────

  @Post('update-historical-run-date')
  @ApiOperation({
    summary: 'Update OTA historical-to date and persist capacity-adjusted run date',
    description:
      'Given a completed job property ID, OTA type, start date, and end date: ' +
      '(1) Writes end_date into the OTA historical "to" field ({ota}_to). ' +
      '(2) Computes the run date: end_date + 1 day + CRS days + 15 days. ' +
      '(3) Persists the run date into the OTA run-date field ' +
      '(expedia_run_date / booking_run_date / agoda_run_date). ' +
      'Both fields are written in a single DB update. ' +
      '200 = updates applied successfully; ' +
      '400 = CRS value is missing or invalid; ' +
      '404 = property not found.'
  })
  @ApiBody({ type: UpdateHistoricalAndRunDateDto })
  @ApiResponse({
    status: 200,
    description: 'Historical-to and run date updated successfully',
    schema: {
      example: {
        property_id: 'prop-id-1',
        ota_type: 'booking',
        historical_to_updated: '2025-10-01',
        run_date: '2026-01-17'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'CRS value is missing or not a valid positive integer' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async updateHistoricalAndRunDate(
    @Body() dto: UpdateHistoricalAndRunDateDto
  ) {
    return this.externalRecurringJobsService.updateHistoricalAndRunDate(dto)
  }
}
