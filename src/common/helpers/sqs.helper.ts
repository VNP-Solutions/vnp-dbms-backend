import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs'
import { Logger } from '@nestjs/common'

const logger = new Logger('SqsHelper')

// Initialize AWS SQS client with credentials (reuses the S3 credentials)
const sqsClient = new SQSClient({
  region: process.env.S3_REGION || 'us-east-1',
  credentials:
    process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY
        }
      : undefined // Falls back to the default credential provider chain
})

export interface SqsMessage {
  /** Stable identifier used to build the FIFO group id and deduplication id */
  groupId: string
  /** JSON-serializable payload placed under the message "body" envelope */
  body: unknown
  /** FIFO message group prefix (defaults to expedia-check) */
  messageGroupPrefix?: string
}

/**
 * Push messages to an AWS SQS queue in batches of 10 (AWS SendMessageBatch limit).
 * Errors are logged and swallowed so a queue failure never breaks the caller's flow.
 * @param queueUrl - Target SQS queue URL
 * @param messages - Messages to enqueue
 */
export async function pushMessagesToQueue(
  queueUrl: string | undefined,
  messages: SqsMessage[]
): Promise<void> {
  try {
    if (!queueUrl) {
      logger.warn('Queue URL not configured. Skipping SQS push.')
      return
    }

    if (!messages || messages.length === 0) {
      logger.log('No messages to push to SQS queue.')
      return
    }

    logger.log(`Preparing to push ${messages.length} message(s) to SQS queue...`)

    const batchSize = 10
    let totalPushed = 0

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)

      const entries = batch.map((message, index) => ({
        Id: `msg-${i + index}`,
        MessageBody: JSON.stringify({
          body: message.body,
          header: {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            timeout: 300000 // 5 minute timeout
          }
        }),
        MessageGroupId: `${message.messageGroupPrefix ?? 'expedia-check'}-${message.groupId}`, // Used by FIFO queues
        MessageDeduplicationId: `${message.groupId}-${Date.now()}-${index}`
      }))

      const command = new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries
      })

      const response = await sqsClient.send(command)

      const successCount = response.Successful?.length || 0
      const failedCount = response.Failed?.length || 0

      totalPushed += successCount

      if (successCount > 0) {
        logger.log(
          `Successfully pushed ${successCount} message(s) to SQS (batch ${Math.floor(i / batchSize) + 1})`
        )
      }

      if (failedCount > 0) {
        logger.error(
          `Failed to push ${failedCount} message(s) to SQS (batch ${Math.floor(i / batchSize) + 1})`
        )
        response.Failed?.forEach(failure => {
          logger.error(`Message ID ${failure.Id} failed: ${failure.Message}`)
        })
      }
    }

    logger.log(
      `Completed SQS push: ${totalPushed}/${messages.length} message(s) successfully pushed to queue.`
    )
  } catch (error) {
    const err = error as Error
    logger.error(`Error pushing messages to SQS queue: ${err.message}`, err.stack)
    // Don't rethrow — a queue failure should not disrupt the caller's flow
  }
}
