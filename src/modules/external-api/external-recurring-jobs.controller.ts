import { Body, Controller, Logger, Post, Res, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { Response } from 'express'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
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
  private readonly logger = new Logger(ExternalRecurringJobsController.name)

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
  @ApiOperation({
    summary: 'Auto-calculate date ranges and create parser jobs (DBMS → Parser bridge)',
    description:
      'Accepts a list of DBMS property IDs and an OTA type. Returns immediately with ' +
      '`{ message: "Processing", data: null }` while job assignment runs in the background. ' +
      'If the scraper backend returns an error, the requesting user is notified by email. ' +
      'For each property, creates one job for the specified OTA type when historical "to" date ' +
      'and CRS are configured. Jobs are forwarded to POST /api/jobs/bulk-create-from-dbms.'
  })
  @ApiBody({ type: BulkCreateParserJobsDto })
  @ApiResponse({
    status: 200,
    description: 'Request accepted — parser job assignment is processing in the background',
    schema: {
      example: { message: 'Processing', data: null }
    }
  })
  assignParserJobs(
    @Body() dto: BulkCreateParserJobsDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    void this.externalRecurringJobsService
      .processAssignParserJobsInBackground(dto, user.email)
      .catch(error =>
        this.logger.error(
          `[assign-parser-jobs] background processing failed: ${error?.message ?? error}`
        )
      )

    return { message: 'Processing', data: null }
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
