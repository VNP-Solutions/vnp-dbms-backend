import {
  BadGatewayException,
  ConflictException,
  GatewayTimeoutException,
  Injectable,
  Logger
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import type { Configuration } from '../../config/configuration'
import type {
  ExpediaCheckPropertyItemDto,
  ExpediaCheckerUpstreamPayload
} from './property.dto'

export interface ExpediaCheckAckResult {
  message: string
  totalProperties: number
  accountGroups: number
}

@Injectable()
export class PropertyExpediaCheckerService {
  private readonly logger = new Logger(PropertyExpediaCheckerService.name)
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    this.baseUrl = this.configService.get('expediaCheckerBaseUrl', { infer: true }) ?? ''
    // Short timeout — upstream acks immediately; 30 s is enough to establish connection
    this.timeoutMs = this.configService.get('expediaCheckerTimeoutMs', { infer: true }) ?? 30_000
  }

  async checkProperties(items: ExpediaCheckPropertyItemDto[]): Promise<ExpediaCheckAckResult> {
    if (!this.baseUrl) {
      this.logger.error('EXPEDIA_CHECKER_BASE_URL is not configured')
      throw new BadGatewayException('Expedia checker URL is not configured. Contact the administrator.')
    }

    // Group items by expedia_username
    const groups = new Map<string, ExpediaCheckPropertyItemDto[]>()
    for (const item of items) {
      const existing = groups.get(item.expedia_username) ?? []
      existing.push(item)
      groups.set(item.expedia_username, existing)
    }

    this.logger.log(
      `Expedia property check dispatched: ${items.length} properties across ${groups.size} account group(s)`
    )

    const targetUrl = `${this.baseUrl}/api/expedia/check-properties`

    // Fire all account groups in parallel — each call acks immediately
    await Promise.all(
      Array.from(groups.entries()).map(async ([_username, groupItems]) => {
        const payload: ExpediaCheckerUpstreamPayload = {
          username: groupItems[0].expedia_username,
          password: groupItems[0].expedia_password,
          expedia_ids: groupItems.map(i => ({ _id: i._id, expedia_id: i.expedia_id }))
        }

        this.logger.log(
          `Dispatching Expedia check for [REDACTED] account — ${groupItems.length} property(s)`
        )

        try {
          await axios.post(targetUrl, payload, {
            timeout: this.timeoutMs,
            headers: { 'Content-Type': 'application/json' }
          })

          this.logger.log(`Expedia checker accepted request for [REDACTED] account`)
        } catch (error) {
          if (axios.isAxiosError(error)) {
            if (error.response) {
              const status = error.response.status
              const body: Record<string, unknown> = error.response.data as Record<string, unknown>

              this.logger.warn(
                `Expedia checker responded ${status} for [REDACTED] account: ${JSON.stringify(body)}`
              )

              if (status === 409) {
                throw new ConflictException(
                  'Expedia checker is busy — another check is already running. Try again later.'
                )
              }

              const upstreamMessage: string =
                typeof body?.message === 'string' ? body.message : `Upstream error ${status}`
              throw new BadGatewayException(`Expedia checker error: ${upstreamMessage}`)
            }

            const code = error.code ?? 'NETWORK_ERROR'
            this.logger.error(
              `Expedia checker unreachable for [REDACTED] account (${code}): ${error.message}`
            )
            throw new GatewayTimeoutException(
              'Expedia checker timed out or is unreachable. Please try again later.'
            )
          }

          throw error
        }
      })
    )

    return {
      message: 'Expedia property check dispatched. Processing is running in background on the checker service.',
      totalProperties: items.length,
      accountGroups: groups.size
    }
  }
}
