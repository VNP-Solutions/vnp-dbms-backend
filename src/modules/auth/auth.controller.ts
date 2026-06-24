import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { Request, Response } from 'express'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { AuthCookieService } from './auth-cookie.service'
import {
  AuthResponseDto,
  CreateSuperAdminDto,
  InviteUserDto,
  LoginRequestOtpDto,
  RefreshTokenDto,
  RequestPasswordResetDto,
  ResendInvitationDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'
import type { IAuthService } from './auth.interface'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'

@ApiTags('Authentication')
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    @Inject('IAuthService')
    private readonly authService: IAuthService,
    private readonly configService: ConfigService,
    private readonly authCookieService: AuthCookieService
  ) {}

  @Post('login/request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for login' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async requestLoginOtp(@Body() body: LoginRequestOtpDto) {
    const result = await this.authService.requestLoginOtp(
      body.email,
      body.password
    )
    return {
      message: result.message,
      data: null
    }
  }

  @Post('login/verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and login',
    description:
      'Sets accessToken and refreshToken as HTTP-only cookies. Returns user profile only. Pass keep_sign_in=false for a shorter browser session (2h for both cookies).'
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto
  })
  async verifyLoginOtp(
    @Body() body: VerifyLoginOtpDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const session = await this.authService.verifyLoginOtp(body)
    this.authCookieService.setAuthCookies(res, session.tokens, {
      keepSignIn: body.keep_sign_in !== false
    })
    return {
      message: 'Login successful',
      data: { user: session.user }
    }
  }

  @Post('invite')
  @Public(false)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Invite a new user (requires authentication and user permission level = all)',
    description:
      'Invite a new user and optionally grant access to specific portfolios and properties. If portfolio_ids or property_ids are provided, a UserAccessedProperty record will be created for the user.'
  })
  @ApiResponse({
    status: 201,
    description: 'User invited successfully with access permissions created'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permission to invite users'
  })
  async inviteUser(
    @Body() body: InviteUserDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const result = await this.authService.inviteUser(
      body,
      user.id,
      user.role?.user_permission?.permission_level
    )
    return {
      message: result.message,
      data: null
    }
  }

  @Post('resend-invitation')
  @Public(false)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Resend invitation email (requires authentication and user permission level = all)'
  })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @ApiResponse({
    status: 400,
    description: 'No pending invitation or cooldown not elapsed (5 minutes)'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permission to resend invitations'
  })
  async resendInvitation(
    @Body() body: ResendInvitationDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    const result = await this.authService.resendInvitation(
      body.email,
      user.role?.user_permission?.permission_level
    )
    return {
      message: result.message,
      data: null
    }
  }

  @Post('verify-invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify invitation and set password',
    description:
      'Sets accessToken and refreshToken as HTTP-only cookies. Returns user profile only.'
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation verified successfully',
    type: AuthResponseDto
  })
  async verifyInvitation(
    @Body() body: VerifyInvitationDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const session = await this.authService.verifyInvitation(body)
    this.authCookieService.setAuthCookies(res, session.tokens)
    return {
      message: 'Invitation verified successfully',
      data: { user: session.user }
    }
  }

  @Post('password/request-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP' })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    const result = await this.authService.requestPasswordReset(body.email)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const result = await this.authService.resetPassword(body)
    return {
      message: result.message,
      data: null
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Reads refreshToken from HTTP-only cookie (or legacy body field). Rotates cookies on success.'
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully via HTTP-only cookies'
  })
  async refreshToken(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const refreshToken =
      req.cookies?.[this.authCookieService.refreshTokenCookieName()] ??
      body.refresh_token

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found')
    }

    const tokens = await this.authService.refreshAccessToken(refreshToken)
    this.authCookieService.setAuthCookies(res, tokens)

    return {
      message: 'Tokens refreshed successfully',
      data: null
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout current session',
    description: 'Clears authentication HTTP-only cookies.'
  })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Res({ passthrough: true }) res: Response) {
    this.authCookieService.clearAuthCookies(res)
    return {
      message: 'Logged out successfully',
      data: null
    }
  }

  @Post('create-super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bootstrap Super Admin account',
    description:
      'One-time endpoint to create the first Super Admin. ' +
      'Requires the x-super-admin-secret header matching the SUPER_ADMIN_SECRET env var. ' +
      'Will fail if a Super Admin user already exists.'
  })
  @ApiHeader({
    name: 'x-super-admin-secret',
    description: 'Secret key to authorize super admin creation',
    required: true
  })
  @ApiResponse({
    status: 201,
    description: 'Super Admin created successfully',
    type: AuthResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing super admin secret'
  })
  @ApiResponse({ status: 409, description: 'Super Admin already exists' })
  async createSuperAdmin(
    @Body() body: CreateSuperAdminDto,
    @Headers('x-super-admin-secret') secret: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const expectedSecret = this.configService.get<string>('superAdminSecret')
    if (!secret || !expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing super admin secret')
    }

    const session = await this.authService.createSuperAdmin(body)
    this.authCookieService.setAuthCookies(res, session.tokens)
    return {
      message: 'Super Admin created successfully',
      data: { user: session.user }
    }
  }
}
