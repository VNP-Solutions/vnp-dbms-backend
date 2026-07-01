import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import {
  pushMessagesToQueue,
  type SqsMessage
} from '../../common/helpers/sqs.helper'
import { triggerLambda } from '../../common/helpers/lambda.helper'
import type {
  AgodaCheckPropertyItemDto,
  AgodaCheckerUpstreamPayload
} from './property.dto'

export interface AgodaCheckAckResult {
  message: string
  totalProperties: number
  accountGroups: number
}

// Delay before triggering Lambda, giving SQS messages time to become visible.
const SQS_VISIBILITY_DELAY_MS = 3000

@Injectable()
export class PropertyAgodaCheckerService {
  private readonly logger = new Logger(PropertyAgodaCheckerService.name)
  private readonly queueUrl: string
  private readonly lambdaFunctionName: string
  private readonly lambdaPlatform: string

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const agodaCheck = this.configService.get('agodaCheck', { infer: true })
    this.queueUrl = agodaCheck?.queueUrl ?? ''
    this.lambdaFunctionName = agodaCheck?.lambdaFunctionName ?? ''
    this.lambdaPlatform = agodaCheck?.lambdaPlatform ?? 'agoda'
  }

  async checkProperties(
    items: AgodaCheckPropertyItemDto[]
  ): Promise<AgodaCheckAckResult> {
    if (!this.queueUrl) {
      this.logger.error('AGODA_CHECK_QUEUE_URL is not configured')
      throw new BadGatewayException(
        'Agoda check queue is not configured. Contact the administrator.'
      )
    }

    // Group items by agoda_username — one queue message per Agoda account
    const groups = new Map<string, AgodaCheckPropertyItemDto[]>()
    for (const item of items) {
      const existing = groups.get(item.agoda_username) ?? []
      existing.push(item)
      groups.set(item.agoda_username, existing)
    }

    this.logger.log(
      `Agoda property check queued: ${items.length} properties across ${groups.size} account group(s)`
    )

    const messages: SqsMessage[] = Array.from(groups.values()).map(groupItems => {
      const payload: AgodaCheckerUpstreamPayload = {
        username: groupItems[0].agoda_username,
        password: groupItems[0].agoda_password,
        agoda_ids: groupItems.map(i => ({ _id: i._id, agoda_id: i.agoda_id }))
      }

      return {
        groupId: String(groupItems[0].agoda_id),
        body: payload,
        messageGroupPrefix: 'agoda-check'
      }
    })

    await pushMessagesToQueue(this.queueUrl, messages)

    await new Promise(resolve => setTimeout(resolve, SQS_VISIBILITY_DELAY_MS))
    await triggerLambda(this.lambdaFunctionName, this.lambdaPlatform)

    return {
      message:
        'Agoda property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
      totalProperties: items.length,
      accountGroups: groups.size
    }
  }

  async triggerCheckLambda(): Promise<{ message: string }> {
    await triggerLambda(this.lambdaFunctionName, this.lambdaPlatform)
    return {
      message: `Agoda check Lambda triggered for platform: ${this.lambdaPlatform}`
    }
  }
}
