import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import {
  pushMessagesToQueue,
  type SqsMessage
} from '../../common/helpers/sqs.helper'
import { triggerLambda } from '../../common/helpers/lambda.helper'
import type {
  ExpediaCheckPropertyItemDto,
  ExpediaCheckerUpstreamPayload
} from './property.dto'

export interface ExpediaCheckAckResult {
  message: string
  totalProperties: number
  accountGroups: number
}

// Delay before triggering Lambda, giving SQS messages time to become visible.
const SQS_VISIBILITY_DELAY_MS = 3000

@Injectable()
export class PropertyExpediaCheckerService {
  private readonly logger = new Logger(PropertyExpediaCheckerService.name)
  private readonly queueUrl: string
  private readonly lambdaFunctionName: string
  private readonly lambdaPlatform: string

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const expediaCheck = this.configService.get('expediaCheck', { infer: true })
    this.queueUrl = expediaCheck?.queueUrl ?? ''
    this.lambdaFunctionName = expediaCheck?.lambdaFunctionName ?? ''
    this.lambdaPlatform = expediaCheck?.lambdaPlatform ?? 'expedia'
  }

  async checkProperties(
    items: ExpediaCheckPropertyItemDto[]
  ): Promise<ExpediaCheckAckResult> {
    if (!this.queueUrl) {
      this.logger.error('EXPEDIA_CHECK_QUEUE_URL is not configured')
      throw new BadGatewayException(
        'Expedia check queue is not configured. Contact the administrator.'
      )
    }

    // Group items by expedia_username — one queue message per Expedia account
    const groups = new Map<string, ExpediaCheckPropertyItemDto[]>()
    for (const item of items) {
      const existing = groups.get(item.expedia_username) ?? []
      existing.push(item)
      groups.set(item.expedia_username, existing)
    }

    this.logger.log(
      `Expedia property check queued: ${items.length} properties across ${groups.size} account group(s)`
    )

    // Build one SQS message per account group, carrying the same payload that
    // was previously POSTed directly to the checker service.
    const messages: SqsMessage[] = Array.from(groups.values()).map(groupItems => {
      const payload: ExpediaCheckerUpstreamPayload = {
        username: groupItems[0].expedia_username,
        password: groupItems[0].expedia_password,
        expedia_ids: groupItems.map(i => ({ _id: i._id, expedia_id: i.expedia_id }))
      }

      return {
        groupId: String(groupItems[0].expedia_id),
        body: payload
      }
    })

    // 1. Push the check payloads to the SQS queue
    await pushMessagesToQueue(this.queueUrl, messages)

    // 2. Wait for the messages to become visible, then trigger the Lambda
    await new Promise(resolve => setTimeout(resolve, SQS_VISIBILITY_DELAY_MS))
    await triggerLambda(this.lambdaFunctionName, this.lambdaPlatform)

    return {
      message:
        'Expedia property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
      totalProperties: items.length,
      accountGroups: groups.size
    }
  }
}
