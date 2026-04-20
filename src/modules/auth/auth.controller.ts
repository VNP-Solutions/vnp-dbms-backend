import {
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Inject,
    Post,
    UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
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
    private readonly configService: ConfigService
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
  @ApiOperation({ summary: 'Verify OTP and login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto
  })
  async verifyLoginOtp(
    @Body() body: VerifyLoginOtpDto
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const result = await this.authService.verifyLoginOtp(body)
    return {
      message: 'Login successful',
      data: result
    }
  }

  @Post('invite')
  @Public(false)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Invite a new user (requires authentication and user permission level = all)', 
    description: 'Invite a new user and optionally grant access to specific portfolios and properties. If portfolio_ids or property_ids are provided, a UserAccessedProperty record will be created for the user.'
  })
  @ApiResponse({ status: 201, description: 'User invited successfully with access permissions created' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permission to invite users' })
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
  @ApiOperation({ summary: 'Verify invitation and set password' })
  @ApiResponse({
    status: 200,
    description: 'Invitation verified successfully',
    type: AuthResponseDto
  })
  async verifyInvitation(
    @Body() body: VerifyInvitationDto
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const result = await this.authService.verifyInvitation(body)
    return {
      message: 'Invitation verified successfully',
      data: result
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
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully (access_token + refresh_token)'
  })
  async refreshToken(@Body() body: RefreshTokenDto) {
    const result = await this.authService.refreshAccessToken(body.refresh_token)
    return {
      message: 'Tokens refreshed successfully',
      data: result
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
  @ApiResponse({ status: 201, description: 'Super Admin created successfully', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or missing super admin secret' })
  @ApiResponse({ status: 409, description: 'Super Admin already exists' })
  async createSuperAdmin(
    @Body() body: CreateSuperAdminDto,
    @Headers('x-super-admin-secret') secret: string
  ): Promise<{ message: string; data: AuthResponseDto }> {
    const expectedSecret = this.configService.get<string>('superAdminSecret')
    if (!secret || !expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing super admin secret')
    }

    const result = await this.authService.createSuperAdmin(body)
    return {
      message: 'Super Admin created successfully',
      data: result
    }
  }
}
