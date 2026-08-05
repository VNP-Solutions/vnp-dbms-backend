import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { IGoogleOAuthRepository } from './google-oauth.interface'

@Injectable()
export class GoogleOAuthSchedulerService {
  private readonly logger = new Logger(GoogleOAuthSchedulerService.name)

  constructor(
    @Inject('IGoogleOAuthRepository')
    private readonly repository: IGoogleOAuthRepository
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleTokenRefresh() {
    this.logger.log(
      'Starting Google OAuth token refresh job (runs every 12 hours)...'
    )

    try {
      const tokenData = await this.repository.loadTokenFromS3()

      if (!tokenData) {
        this.logger.warn(
          'No Google OAuth token found in S3. Please authenticate first by visiting /api/google-oauth/auth'
        )
        return
      }

      if (!tokenData.refresh_token) {
        this.logger.error(
          'No refresh token available. Re-authentication required.'
        )
        return
      }

      if (!this.repository.needsTokenRefresh(tokenData)) {
        this.logger.log(
          'Token is still valid and does not need refresh at this time'
        )
        return
      }

      this.logger.log('Token is expiring soon, refreshing...')
      const newTokenData = await this.repository.refreshToken(
        tokenData.refresh_token
      )

      await this.repository.saveTokenToS3(newTokenData)

      this.logger.log(
        'Google OAuth token refresh job completed successfully. New token saved to S3.'
      )
    } catch (error: any) {
      this.logger.error(
        `Error during Google OAuth token refresh: ${error.message}`,
        error.stack
      )
    }
  }

  async triggerTokenRefresh() {
    this.logger.log('Manually triggering Google OAuth token refresh...')
    await this.handleTokenRefresh()
  }
}
