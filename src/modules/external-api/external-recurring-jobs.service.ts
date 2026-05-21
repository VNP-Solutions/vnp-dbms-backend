import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { Configuration } from '../../config/configuration'
import type {
  DbmsPreCheckDto,
  ScraperIngestPayload
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
    private readonly configService: ConfigService<Configuration, true>
  ) {
    this.scraperBackendUrl =
      this.configService.get('scraperBackendUrl', { infer: true }) ?? ''
  }

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ({ billing_type: _billing_type, ...rest }) => rest
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
}
