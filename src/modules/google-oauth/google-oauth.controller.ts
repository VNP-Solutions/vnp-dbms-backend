import { Controller, Get, Query, Res } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { GoogleOAuthService } from './google-oauth.service'

@ApiTags('Google OAuth')
@Public()
@Controller('google-oauth')
export class GoogleOAuthController {
  constructor(private readonly googleOAuthService: GoogleOAuthService) {}

  @Get('auth')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async auth(@Res() res: Response) {
    const authUrl = this.googleOAuthService.getAuthUrl()
    return res.redirect(authUrl)
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiQuery({ name: 'code', required: true, description: 'Authorization code' })
  async callback(@Query('code') code: string, @Res() res: Response) {
    try {
      await this.googleOAuthService.handleCallback(code)
      return res.send(
        '<h1>Authentication Successful!</h1><p>You can close this window now.</p>'
      )
    } catch (error) {
      return res.status(500).send(
        `<h1>Authentication Failed</h1><p>${error.message}</p>`
      )
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Check Google OAuth authentication status' })
  async status(@Res() res: Response) {
    const isAuthenticated = await this.googleOAuthService.isAuthenticated()
    return res.json({
      authenticated: isAuthenticated,
      message: isAuthenticated
        ? 'Google OAuth is authenticated'
        : 'Google OAuth is not authenticated. Please visit /api/google-oauth/auth to authenticate.'
    })
  }
}
