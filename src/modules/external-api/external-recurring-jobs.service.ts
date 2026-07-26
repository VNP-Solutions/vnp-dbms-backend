import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { Configuration } from '../../config/configuration'
import {
  calcAgodaParserJobEndDate,
  calcAgodaParserJobStartDate,
  calcParserJobEndDate,
  calcParserJobStartDate,
  parseCrsDays
} from '../../common/utils/parser-job-date.util'
import { RunDateCalculatorService } from '../../common/services/run-date-calculator.service'
import { PrismaService } from '../prisma/prisma.service'
import type {
  BulkCreateParserJobsDto,
  BulkCreateParserJobsPayload,
  BulkCreateParserJobsPropertyResult,
  DbmsPreCheckDto,
  ParserJobEntryPayload,
  ScraperIngestPayload,
  UpdateHistoricalAndRunDateDto,
  UpdateHistoricalAndRunDateResult
} from './external-api.dto'

export interface ScraperRelayResult {
  status: number
  body: unknown
}

@Injectable()
export class ExternalRecurringJobsService {
  private readonly logger = new Logger(ExternalRecurringJobsService.name)
  private readonly scraperBackendUrl: string

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
    private readonly runDateCalculator: RunDateCalculatorService
  ) {
    this.scraperBackendUrl =
      this.configService.get('scraperBackendUrl', { infer: true }) ?? ''
  }

  // ─── DBMS Pre-Check ──────────────────────────────────────────────────────────

  async dbmsPreCheck(dto: DbmsPreCheckDto): Promise<ScraperRelayResult> {
    if (!this.scraperBackendUrl) {
      this.logger.error(
        'SCRAPER_BACKEND_URL is not configured — cannot forward pre-check'
      )
      throw new BadGatewayException(
        'Scraper backend URL is not configured. Contact the administrator.'
      )
    }

    const payload: ScraperIngestPayload = {
      properties: dto.properties.map(
        ({ billing_type: _bt, ...rest }) => rest
      )
    }

    const targetUrl = `${this.scraperBackendUrl}/recurring-jobs/dbms-ingest`
    this.logger.log(`Forwarding pre-check to scraper: POST ${targetUrl}`)

    try {
      await axios.post(targetUrl, payload, { timeout: 30_000 })
      return { status: 200, body: { message: 'Processing', data: null } }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.warn(
            `Scraper responded ${error.response.status} for pre-check`
          )
          return { status: error.response.status, body: error.response.data }
        }

        this.logger.error(
          `Scraper backend unreachable (${error.code ?? 'NETWORK_ERROR'}): ${error.message}`
        )
        throw new BadGatewayException(
          'Scraper backend is unreachable. Please try again later.'
        )
      }

      throw error
    }
  }

  // ─── Bulk Create Parser Jobs ──────────────────────────────────────────────────

  /**
   * For each property ID in the request:
   *  1. Fetches the property from the database.
   *  2. For every OTA type that has a configured historical-to date and CRS value,
   *     computes:
   *       start_date = historical_to + 1 day
   *       end_date   = start_date + crs_months  (booking gets +1 year on top)
   *  3. Forwards all generated jobs to the parser backend in a single POST request.
   *
   * Returns a summary of jobs created / OTAs skipped per property alongside the
   * raw parser-backend relay result.
   */
  async bulkCreateParserJobs(dto: BulkCreateParserJobsDto): Promise<{
    relay: ScraperRelayResult
    summary: BulkCreateParserJobsPropertyResult[]
  }> {
    if (!this.scraperBackendUrl) {
      this.logger.error(
        'SCRAPER_BACKEND_URL is not configured — cannot create parser jobs'
      )
      throw new BadGatewayException(
        'Scraper backend URL is not configured. Contact the administrator.'
      )
    }

    // 1. Fetch all requested properties in one query
    const properties = await this.prisma.property.findMany({
      where: { id: { in: dto.property_ids } },
      include: {
        expedia_billing_type: { select: { name: true } },
        booking_billing_type: { select: { name: true } },
        agoda_billing_type: { select: { name: true } }
      }
    })

    // Validate that all requested IDs were found
    if (properties.length !== dto.property_ids.length) {
      const foundIds = new Set(properties.map(p => p.id))
      const missing = dto.property_ids.filter(id => !foundIds.has(id))
      throw new NotFoundException(
        `The following property IDs were not found: ${missing.join(', ')}`
      )
    }

    const jobs: ParserJobEntryPayload[] = []
    const summary: BulkCreateParserJobsPropertyResult[] = []

    // 2. Build one job per property for the requested OTA type
    for (const property of properties) {
      const result: BulkCreateParserJobsPropertyResult = {
        property_id: property.id,
        name: property.name,
        jobs_created: [],
        skipped_otas: []
      }

      const ota = dto.ota_type
      const otaConfig = {
        ota_id:
          ota === 'expedia'
            ? property.expedia_id
            : ota === 'booking'
              ? property.booking_id
              : property.agoda_id,
        historical_to:
          ota === 'expedia'
            ? property.expedia_to
            : ota === 'booking'
              ? property.booking_to
              : property.agoda_to,
        crs:
          ota === 'expedia'
            ? property.expedia_crs
            : ota === 'booking'
              ? property.booking_crs
              : property.agoda_crs,
        billing_type:
          ota === 'expedia'
            ? ((property as any).expedia_billing_type?.name ?? null)
            : ota === 'booking'
              ? ((property as any).booking_billing_type?.name ?? null)
              : ((property as any).agoda_billing_type?.name ?? null),
        is_booking: ota === 'booking'
      }

      if (otaConfig.ota_id == null) {
        result.skipped_otas.push({
          ota_type: ota,
          reason: `No ${ota}_id configured`
        })
      } else if (!otaConfig.historical_to) {
        result.skipped_otas.push({
          ota_type: ota,
          reason: `No historical "to" date (${ota}_to) configured`
        })
      } else {
        const crsDays = parseCrsDays(otaConfig.crs)
        if (crsDays === null) {
          result.skipped_otas.push({
            ota_type: ota,
            reason: `CRS value "${otaConfig.crs}" is missing or not a valid positive integer`
          })
        } else {
          let startDate: string
          let endDate: string

          if (ota === 'agoda') {
            startDate = calcAgodaParserJobStartDate(otaConfig.historical_to, crsDays)
            endDate = calcAgodaParserJobEndDate(otaConfig.historical_to, crsDays)
          } else {
            startDate = calcParserJobStartDate(otaConfig.historical_to)
            endDate = calcParserJobEndDate(startDate, crsDays, otaConfig.is_booking)
          }

          jobs.push({
            parent_id: property.id,
            ota_type: ota,
            start_date: startDate,
            end_date: endDate,
            billing_type: otaConfig.billing_type
          })

          result.jobs_created.push({ ota_type: ota, start_date: startDate, end_date: endDate })
        }
      }

      summary.push(result)
    }

    // 3. Forward to parser backend
    const payload: BulkCreateParserJobsPayload = { jobs }
    const targetUrl = `${this.scraperBackendUrl}/api/jobs/bulk-create-from-dbms`
    this.logger.log(
      `Forwarding ${jobs.length} parser job(s) to: POST ${targetUrl}`
    )

    let relay: ScraperRelayResult = {
      status: 200,
      body: { message: 'Processing', data: null }
    }

    try {
      await axios.post(targetUrl, payload, { timeout: 30_000 })
      // relay already holds the success default assigned above
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.warn(
            `Parser backend responded ${error.response.status} for bulk-create-parser-jobs`
          )
          relay = { status: error.response.status, body: error.response.data }
        } else {
          this.logger.error(
            `Parser backend unreachable (${error.code ?? 'NETWORK_ERROR'}): ${error.message}`
          )
          throw new BadGatewayException(
            'Parser backend is unreachable. Please try again later.'
          )
        }
      } else {
        throw error
      }
    }

    return { relay, summary }
  }

  // ─── Update Historical To + Run Date ─────────────────────────────────────────

  /**
   * Given a completed job's `parent_id`, `ota_type`, `start_date`, and `end_date`:
   *
   *  1. Fetches the property from the database.
   *  2. Writes `end_date` into the OTA's historical "to" field  ({ota}_to).
   *  3. Calculates the run date:
   *       run_date = end_date + 1 day + CRS days + 15 days
   *  4. Writes the run date into the OTA's run-date field:
   *       expedia → expedia_run_date
   *       booking → booking_run_date
   *       agoda   → agoda_run_date
   */
  async updateHistoricalAndRunDate(
    dto: UpdateHistoricalAndRunDateDto
  ): Promise<UpdateHistoricalAndRunDateResult> {
    // 1. Fetch property
    const property = await this.prisma.property.findUnique({
      where: { id: dto.parent_id }
    })
    if (!property) {
      throw new NotFoundException(
        `Property with ID "${dto.parent_id}" was not found`
      )
    }

    // 2. Resolve CRS for the requested OTA
    const crsRaw =
      dto.ota_type === 'expedia'
        ? property.expedia_crs
        : dto.ota_type === 'booking'
          ? property.booking_crs
          : property.agoda_crs

    if (!parseCrsDays(crsRaw)) {
      throw new BadRequestException(
        `CRS value "${crsRaw}" for ${dto.ota_type} is missing or not a valid positive integer`
      )
    }

    const historicalToField =
      dto.ota_type === 'expedia'
        ? 'expedia_to'
        : dto.ota_type === 'booking'
          ? 'booking_to'
          : 'agoda_to'

    // 3. Calculate capacity-checked run date via shared service
    const runDate = await this.runDateCalculator.calcRunDate(
      dto.end_date,
      crsRaw,
      dto.ota_type,
      dto.parent_id
    )

    if (!runDate) {
      throw new BadRequestException(
        `Could not calculate run date for ${dto.ota_type} — CRS is invalid`
      )
    }

    const runDateField =
      dto.ota_type === 'expedia'
        ? 'expedia_run_date'
        : dto.ota_type === 'booking'
          ? 'booking_run_date'
          : 'agoda_run_date'

    // 4. Persist both fields in a single update
    await this.prisma.property.update({
      where: { id: dto.parent_id },
      data: {
        [historicalToField]: dto.end_date,
        [runDateField]: runDate
      }
    })

    this.logger.log(
      `[updateHistoricalAndRunDate] property=${dto.parent_id} ota=${dto.ota_type} ` +
        `historical_to=${dto.end_date} run_date=${runDate}`
    )

    return {
      property_id: dto.parent_id,
      ota_type: dto.ota_type,
      historical_to_updated: dto.end_date,
      run_date: runDate
    }
  }
}
