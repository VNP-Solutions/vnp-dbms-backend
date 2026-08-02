import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { Configuration } from '../../config/configuration'
import { EmailUtil } from '../../common/utils/email.util'
import {
  calcAgodaParserJobEndDate,
  calcAgodaParserJobStartDate,
  calcParserJobEndDate,
  calcParserJobStartDate,
  parseCrsDays
} from '../../common/utils/parser-job-date.util'
import { RunDateCalculatorService } from '../../common/services/run-date-calculator.service'
import { GlobalFilterCacheService } from '../../common/services/global-filter-cache.service'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { PrismaService } from '../prisma/prisma.service'
import type {
  BulkCreateParserJobsDto,
  BulkCreateParserJobsPayload,
  BulkCreateParserJobsPropertyResult,
  BulkUploadRetrievalJobsPayload,
  BulkUploadRetrievalJobsResult,
  BulkUploadRetrievalJobsSummaryItem,
  DbmsPreCheckDto,
  ParserJobEntryPayload,
  ScraperIngestPayload,
  UpdateHistoricalAndRunDateDto,
  UpdateHistoricalAndRunDateResult
} from './external-api.dto'
import {
  getRetrievalGroupDisplayName,
  parseRetrievalExcelBuffer
} from '../../common/utils/retrieval-excel.util'

export interface ScraperRelayResult {
  status: number
  body: unknown
}

type ParserJobAssignmentFailure = {
  name?: string
  property_id?: string
  error: string
}

type RetrievalJobAssignmentFailure = {
  name?: string
  hotel_id?: string
  error: string
}

@Injectable()
export class ExternalRecurringJobsService {
  private readonly logger = new Logger(ExternalRecurringJobsService.name)
  private readonly scraperBackendUrl: string

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
    private readonly runDateCalculator: RunDateCalculatorService,
    private readonly emailUtil: EmailUtil,
    private readonly syncCommunication: SyncCommunicationService,
    private readonly globalFilterCache: GlobalFilterCacheService
  ) {
    this.scraperBackendUrl =
      this.configService.get('scraperBackendUrl', { infer: true }) ?? ''
  }

  private scraperRequestConfig(): { timeout: number; headers: Record<string, string> } {
    if (!this.syncCommunication.isConfigured()) {
      throw new BadGatewayException(
        'JWT_COMMUNICATION_SECRET is not configured. Cannot authenticate with scraper backend.'
      )
    }

    return {
      timeout: 30_000,
      headers: this.syncCommunication.createAuthHeaders()
    }
  }

  private collectLocalSkippedFailures(
    summary: BulkCreateParserJobsPropertyResult[]
  ): ParserJobAssignmentFailure[] {
    return summary.flatMap(item =>
      item.skipped_otas.map(skip => ({
        name: item.name,
        property_id: item.property_id,
        error: `${skip.ota_type}: ${skip.reason}`
      }))
    )
  }

  private collectScraperFailures(body: unknown): ParserJobAssignmentFailure[] {
    if (!body || typeof body !== 'object') return []

    const failures: ParserJobAssignmentFailure[] = []
    const root = body as Record<string, unknown>
    const data =
      root.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : root

    const pushFailure = (item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const error =
        row.error_message ??
        row.error ??
        row.message ??
        row.reason ??
        row.description

      if (error == null) return

      const errorText =
        typeof error === 'string'
          ? error
          : typeof error === 'number' || typeof error === 'boolean'
            ? String(error)
            : JSON.stringify(error)

      failures.push({
        name:
          typeof row.name === 'string'
            ? row.name
            : typeof row.property_name === 'string'
              ? row.property_name
              : undefined,
        property_id:
          typeof row.property_id === 'string'
            ? row.property_id
            : typeof row.parent_id === 'string'
              ? row.parent_id
              : undefined,
        error: errorText
      })
    }

    if (Array.isArray(data.descriptions)) {
      data.descriptions.forEach(pushFailure)
    }

    for (const key of ['failed', 'failures', 'errors', 'items']) {
      if (Array.isArray(data[key])) {
        data[key].forEach(pushFailure)
      }
    }

    if (Array.isArray(root.descriptions)) {
      root.descriptions.forEach(pushFailure)
    }

    for (const key of ['failed', 'failures', 'errors']) {
      if (Array.isArray(root[key])) {
        root[key].forEach(pushFailure)
      }
    }

    return failures
  }

  private collectParserJobAssignmentFailures(result: {
    relay: ScraperRelayResult
    summary: BulkCreateParserJobsPropertyResult[]
  }): ParserJobAssignmentFailure[] {
    const failures = [
      ...this.collectLocalSkippedFailures(result.summary),
      ...this.collectScraperFailures(result.relay.body)
    ]

    if (result.relay.status !== 200) {
      failures.unshift({
        error: `Scraper backend responded with HTTP ${result.relay.status}`
      })
    }

    return failures
  }

  private extractScraperMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined
    const message = (body as Record<string, unknown>).message
    return typeof message === 'string' ? message : undefined
  }

  private buildParserJobAssignmentReport(
    summary: BulkCreateParserJobsPropertyResult[],
    scraperFailures: ParserJobAssignmentFailure[],
    httpStatus?: number
  ): Array<{
    name: string
    property_id: string
    dbms_ok: boolean
    parser_ok: boolean
    reason: string
  }> {
    const propertyFailures = scraperFailures.filter(
      failure => failure.property_id || failure.name
    )
    const failureByPropertyId = new Map(
      propertyFailures
        .filter(failure => failure.property_id)
        .map(failure => [failure.property_id!, failure.error])
    )
    const failureByName = new Map(
      propertyFailures
        .filter(failure => failure.name)
        .map(failure => [failure.name!, failure.error])
    )
    const globalFailure = scraperFailures.find(
      failure => !failure.property_id && !failure.name
    )?.error
    const parserFallbackReason =
      globalFailure ??
      (httpStatus != null && httpStatus !== 200
        ? `Parser backend responded with HTTP ${httpStatus}`
        : undefined)

    return summary.map(item => {
      const localSkip = item.skipped_otas[0]
      const dbmsOk = item.jobs_created.length > 0

      if (!dbmsOk) {
        return {
          name: item.name,
          property_id: item.property_id,
          dbms_ok: false,
          parser_ok: false,
          reason: localSkip?.reason ?? 'Skipped during DBMS validation'
        }
      }

      const scraperError =
        failureByPropertyId.get(item.property_id) ??
        failureByName.get(item.name)

      if (scraperError) {
        return {
          name: item.name,
          property_id: item.property_id,
          dbms_ok: true,
          parser_ok: false,
          reason: scraperError
        }
      }

      if (parserFallbackReason) {
        return {
          name: item.name,
          property_id: item.property_id,
          dbms_ok: true,
          parser_ok: false,
          reason: parserFallbackReason
        }
      }

      return {
        name: item.name,
        property_id: item.property_id,
        dbms_ok: true,
        parser_ok: true,
        reason: '-'
      }
    })
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
      await axios.post(targetUrl, payload, this.scraperRequestConfig())
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
   * Runs parser job assignment in the background. On scraper-backend failure or
   * any thrown error, sends an email notification to the requesting user.
   */
  async processAssignParserJobsInBackground(
    dto: BulkCreateParserJobsDto,
    recipientEmail: string
  ): Promise<void> {
    try {
      const result = await this.bulkCreateParserJobs(dto)
      const failures = this.collectParserJobAssignmentFailures(result)

      if (failures.length > 0) {
        await this.emailUtil.sendParserJobAssignmentErrorEmail(recipientEmail, {
          ota_type: dto.ota_type,
          property_count: dto.property_ids.length,
          message: this.extractScraperMessage(result.relay.body),
          rows: this.buildParserJobAssignmentReport(
            result.summary,
            failures,
            result.relay.status
          )
        })
      }
    } catch (error: any) {
      this.logger.error(
        `[assign-parser-jobs] failed for ${dto.property_ids.length} properties: ${error?.message ?? error}`
      )

      await this.emailUtil
        .sendParserJobAssignmentErrorEmail(recipientEmail, {
          ota_type: dto.ota_type,
          property_count: dto.property_ids.length,
          message: error?.message ?? 'Request failed before job assignment completed'
        })
        .catch(emailError =>
          this.logger.error(
            `[assign-parser-jobs] error email failed: ${emailError?.message ?? emailError}`
          )
        )
    }
  }

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
    const targetUrl = `${this.scraperBackendUrl}/jobs/bulk-create-from-dbms`
    this.logger.log(
      `Forwarding ${jobs.length} parser job(s) to: POST ${targetUrl}`
    )

    let relay: ScraperRelayResult = {
      status: 200,
      body: { message: 'Processing', data: null }
    }

    if (jobs.length > 0) {
      try {
        const response = await axios.post(
          targetUrl,
          payload,
          this.scraperRequestConfig()
        )
        relay = {
          status: response.status,
          body: response.data ?? { message: 'Processing', data: null }
        }
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
    }

    return { relay, summary }
  }

  // ─── Bulk Upload Retrieval Jobs ─────────────────────────────────────────────

  /**
   * Runs retrieval job upload in the background. On scraper-backend failure or
   * any thrown error, sends an email notification to the requesting user.
   */
  async processUploadRetrievalJobsInBackground(
    file: Express.Multer.File,
    recipientEmail: string
  ): Promise<void> {
    try {
      const payload = parseRetrievalExcelBuffer(file.originalname, file.buffer)
      const result = await this.uploadRetrievalJobs(payload)
      const failures = this.collectRetrievalJobAssignmentFailures(result)

      if (failures.length > 0) {
        await this.emailUtil.sendRetrievalJobAssignmentErrorEmail(recipientEmail, {
          hotel_count: payload.groups.length,
          file_name: file.originalname,
          message: this.extractScraperMessage(result.relay.body),
          rows: this.buildRetrievalJobAssignmentReport(result, failures)
        })
      }
    } catch (error: any) {
      this.logger.error(
        `[upload-retrieval-jobs] failed for file ${file?.originalname ?? 'unknown'}: ${error?.message ?? error}`
      )

      await this.emailUtil
        .sendRetrievalJobAssignmentErrorEmail(recipientEmail, {
          hotel_count: 0,
          file_name: file?.originalname ?? 'unknown',
          message:
            error?.message ?? 'Request failed before retrieval job upload completed'
        })
        .catch(emailError =>
          this.logger.error(
            `[upload-retrieval-jobs] error email failed: ${emailError?.message ?? emailError}`
          )
        )
    }
  }

  /**
   * Parses grouped Excel rows and forwards them to the scraper backend
   * POST /retrieval/bulk-create-from-dbms endpoint.
   */
  async uploadRetrievalJobs(
    payload: BulkUploadRetrievalJobsPayload
  ): Promise<BulkUploadRetrievalJobsResult> {
    if (!this.scraperBackendUrl) {
      this.logger.error(
        'SCRAPER_BACKEND_URL is not configured — cannot create retrieval jobs'
      )
      throw new BadGatewayException(
        'Scraper backend URL is not configured. Contact the administrator.'
      )
    }

    const summary: BulkUploadRetrievalJobsSummaryItem[] = payload.groups.map(
      group => ({
        hotel_id: group.hotel_id,
        name: getRetrievalGroupDisplayName(group)
      })
    )

    const targetUrl = `${this.scraperBackendUrl}/retrieval/bulk-create-from-dbms`
    this.logger.log(
      `Forwarding ${payload.groups.length} retrieval group(s) to: POST ${targetUrl}`
    )

    let relay: ScraperRelayResult = {
      status: 200,
      body: { message: 'Processing', data: null }
    }

    try {
      const response = await axios.post(
        targetUrl,
        payload,
        this.scraperRequestConfig()
      )
      relay = {
        status: response.status,
        body: response.data ?? { message: 'Processing', data: null }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.warn(
            `Scraper backend responded ${error.response.status} for bulk-create-retrievals`
          )
          relay = { status: error.response.status, body: error.response.data }
        } else {
          this.logger.error(
            `Scraper backend unreachable (${error.code ?? 'NETWORK_ERROR'}): ${error.message}`
          )
          throw new BadGatewayException(
            'Scraper backend is unreachable. Please try again later.'
          )
        }
      } else {
        throw error
      }
    }

    return { relay, summary, payload }
  }

  private collectRetrievalScraperFailures(
    body: unknown
  ): RetrievalJobAssignmentFailure[] {
    if (!body || typeof body !== 'object') return []

    const failures: RetrievalJobAssignmentFailure[] = []
    const root = body as Record<string, unknown>
    const data =
      root.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : root

    const pushFailure = (item: unknown) => {
      if (!item || typeof item !== 'object') return
      const row = item as Record<string, unknown>
      const error =
        row.error_message ??
        row.error ??
        row.message ??
        row.reason ??
        row.description

      if (error == null) return

      failures.push({
        name:
          typeof row.name === 'string'
            ? row.name
            : typeof row.property_name === 'string'
              ? row.property_name
              : undefined,
        hotel_id:
          typeof row.hotel_id === 'string'
            ? row.hotel_id
            : typeof row.hotelId === 'string'
              ? row.hotelId
              : undefined,
        error:
          typeof error === 'string'
            ? error
            : typeof error === 'number' || typeof error === 'boolean'
              ? String(error)
              : JSON.stringify(error)
      })
    }

    if (Array.isArray(data.errors)) {
      data.errors.forEach(pushFailure)
    }

    for (const key of ['failed', 'failures', 'items']) {
      if (Array.isArray(data[key])) {
        data[key].forEach(pushFailure)
      }
    }

    return failures
  }

  private collectRetrievalJobAssignmentFailures(
    result: BulkUploadRetrievalJobsResult
  ): RetrievalJobAssignmentFailure[] {
    const failures = this.collectRetrievalScraperFailures(result.relay.body)

    if (result.relay.status !== 200) {
      failures.unshift({
        error: `Scraper backend responded with HTTP ${result.relay.status}`
      })
    }

    return failures
  }

  private buildRetrievalJobAssignmentReport(
    result: BulkUploadRetrievalJobsResult,
    scraperFailures: RetrievalJobAssignmentFailure[]
  ): Array<{
    name: string
    hotel_id: string
    dbms_ok: boolean
    scraper_ok: boolean
    reason: string
  }> {
    const hotelFailures = scraperFailures.filter(
      failure => failure.hotel_id || failure.name
    )
    const failureByHotelId = new Map(
      hotelFailures
        .filter(failure => failure.hotel_id)
        .map(failure => [failure.hotel_id!, failure.error])
    )
    const failureByName = new Map(
      hotelFailures
        .filter(failure => failure.name)
        .map(failure => [failure.name!, failure.error])
    )
    const globalFailure = scraperFailures.find(
      failure => !failure.hotel_id && !failure.name
    )?.error
    const scraperFallbackReason =
      globalFailure ??
      (result.relay.status !== 200
        ? `Scraper backend responded with HTTP ${result.relay.status}`
        : undefined)

    return result.summary.map(item => {
      const scraperError =
        failureByHotelId.get(item.hotel_id) ?? failureByName.get(item.name)

      if (scraperError) {
        return {
          name: item.name,
          hotel_id: item.hotel_id,
          dbms_ok: true,
          scraper_ok: false,
          reason: scraperError
        }
      }

      if (scraperFallbackReason) {
        return {
          name: item.name,
          hotel_id: item.hotel_id,
          dbms_ok: true,
          scraper_ok: false,
          reason: scraperFallbackReason
        }
      }

      return {
        name: item.name,
        hotel_id: item.hotel_id,
        dbms_ok: true,
        scraper_ok: true,
        reason: '-'
      }
    })
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

    await this.globalFilterCache.invalidateAll()

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
