import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { Logger } from '@nestjs/common'

const logger = new Logger('LambdaHelper')

// Initialize AWS Lambda client with credentials (reuses the S3 credentials)
const lambdaClient = new LambdaClient({
  region: process.env.S3_REGION || 'us-east-1',
  credentials:
    process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY
        }
      : undefined // Falls back to the default credential provider chain
})

/**
 * Trigger an AWS Lambda function asynchronously (Event invocation).
 * Errors are logged and swallowed so a trigger failure never breaks the caller's flow.
 * @param functionName - Name/ARN of the Lambda function to invoke
 * @param platform - Platform value forwarded as the Lambda payload
 */
export async function triggerLambda(
  functionName: string | undefined,
  platform: string
): Promise<void> {
  try {
    if (!functionName) {
      logger.warn('Lambda function name not configured. Skipping Lambda trigger.')
      return
    }

    if (!platform) {
      logger.warn('Platform not provided. Skipping Lambda trigger.')
      return
    }

    logger.log(
      `Triggering Lambda function "${functionName}" for platform: ${platform}`
    )

    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Asynchronous invocation
      Payload: JSON.stringify({ platform })
    })

    await lambdaClient.send(command)

    logger.log(`Successfully triggered Lambda function for platform: ${platform}`)
  } catch (error) {
    const err = error as Error
    logger.error(`Error triggering Lambda function: ${err.message}`, err.stack)
    // Don't rethrow — a trigger failure should not disrupt the caller's flow
  }
}
