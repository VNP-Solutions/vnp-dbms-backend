import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import {
  pushMessagesToQueue,
  type SqsMessage
} from '../../common/helpers/sqs.helper'
import { triggerLambda } from '../../common/helpers/lambda.helper'
import type {
  BookingCheckPropertyItemDto,
  BookingCheckerUpstreamPayload
} from './property.dto'

export interface BookingCheckAckResult {
  message: string
  totalProperties: number
  accountGroups: number
}

// Delay before triggering Lambda, giving SQS messages time to become visible.
const SQS_VISIBILITY_DELAY_MS = 3000

@Injectable()
export class PropertyBookingCheckerService {
  private readonly logger = new Logger(PropertyBookingCheckerService.name)
  private readonly queueUrl: string
  private readonly lambdaFunctionName: string
  private readonly lambdaPlatform: string

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const bookingCheck = this.configService.get('bookingCheck', { infer: true })
    this.queueUrl = bookingCheck?.queueUrl ?? ''
    this.lambdaFunctionName = bookingCheck?.lambdaFunctionName ?? ''
    this.lambdaPlatform = bookingCheck?.lambdaPlatform ?? 'booking'
  }

  async checkProperties(
    items: BookingCheckPropertyItemDto[]
  ): Promise<BookingCheckAckResult> {
    if (!this.queueUrl) {
      this.logger.error('BOOKING_CHECK_QUEUE_URL is not configured')
      throw new BadGatewayException(
        'Booking check queue is not configured. Contact the administrator.'
      )
    }

    // Group items by booking_username — one queue message per Booking account
    const groups = new Map<string, BookingCheckPropertyItemDto[]>()
    for (const item of items) {
      const existing = groups.get(item.booking_username) ?? []
      existing.push(item)
      groups.set(item.booking_username, existing)
    }

    this.logger.log(
      `Booking property check queued: ${items.length} properties across ${groups.size} account group(s)`
    )

    // Payload shape matches the scraper's POST /api/booking/check-properties
    // body, which the checker Lambda replays once it drains this message.
    const messages: SqsMessage[] = Array.from(groups.values()).map(groupItems => {
      const payload: BookingCheckerUpstreamPayload = {
        username: groupItems[0].booking_username,
        password: groupItems[0].booking_password,
        booking_ids: groupItems.map(i => ({ _id: i._id, booking_id: i.booking_id }))
      }

      return {
        groupId: String(groupItems[0].booking_id),
        body: payload,
        messageGroupPrefix: 'booking-check'
      }
    })

    await pushMessagesToQueue(this.queueUrl, messages)

    await new Promise(resolve => setTimeout(resolve, SQS_VISIBILITY_DELAY_MS))
    await triggerLambda(this.lambdaFunctionName, this.lambdaPlatform)

    return {
      message:
        'Booking property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
      totalProperties: items.length,
      accountGroups: groups.size
    }
  }

  /**
   * Re-trigger the checker Lambda so it drains the next queued payload.
   * Called by the scraper after a property check finishes — the scraper only
   * runs one check at a time, so groups are processed one at a time.
   */
  async triggerCheckLambda(): Promise<{ message: string }> {
    await triggerLambda(this.lambdaFunctionName, this.lambdaPlatform)
    return {
      message: `Booking check Lambda triggered for platform: ${this.lambdaPlatform}`
    }
  }
}
