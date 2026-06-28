import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Public } from '../auth/decorators/public.decorator'
import { triggerLambda } from '../../common/helpers/lambda.helper'
import { TriggerLambdaDto } from './external-api.dto'

@ApiTags('External API - Lambda')
@Controller('external/lambda')
export class ExternalLambdaTriggerController {
  private readonly logger = new Logger(ExternalLambdaTriggerController.name)

  @Post('trigger')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Manually trigger the configured AWS Lambda function (public)',
    description:
      'Sends an asynchronous (Event) invocation to the Lambda function ' +
      'configured via EXPEDIA_CHECK_LAMBDA_FUNCTION_NAME. ' +
      'The `platform` field is forwarded as the Lambda payload and defaults to ' +
      'EXPEDIA_CHECK_LAMBDA_PLATFORM when not supplied. ' +
      'This endpoint is intentionally unauthenticated so external schedulers and ' +
      'scripts can invoke it without a JWT token.'
  })
  @ApiBody({ type: TriggerLambdaDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Lambda trigger dispatched',
    schema: {
      example: {
        message: 'Lambda trigger dispatched',
        functionName: 'popertyCredCheker',
        platform: 'expedia'
      }
    }
  })
  async trigger(@Body() dto: TriggerLambdaDto = {}) {
    const functionName =
      process.env.EXPEDIA_CHECK_LAMBDA_FUNCTION_NAME ?? ''
    const platform =
      dto.platform ?? process.env.EXPEDIA_CHECK_LAMBDA_PLATFORM ?? 'expedia'

    this.logger.log(
      `Manual Lambda trigger requested — function: "${functionName}", platform: "${platform}"`
    )

    await triggerLambda(functionName, platform)

    return {
      message: 'Lambda trigger dispatched',
      functionName,
      platform
    }
  }
}
