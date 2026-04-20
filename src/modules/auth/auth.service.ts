import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { AccessLevel, PermissionLevel } from '@prisma/client'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import {
  AuthResponseDto,
  CreateSuperAdminDto,
  InviteUserDto,
  ResetPasswordDto,
  VerifyInvitationDto,
  VerifyLoginOtpDto
} from './auth.dto'
import type {
  IAuthRepository,
  IAuthService,
  JwtPayload
} from './auth.interface'

interface UserWithRole {
  id: string
  email: string
  first_name: string
  last_name: string
  user_role_id: string
  role: {
    id: string
    name: string
    description: string
    is_external: boolean
    can_access_mis?: boolean
    portfolio_permission: { permission_level: string; access_level: string } | null
    property_permission: { permission_level: string; access_level: string } | null
    audit_permission: { permission_level: string; access_level: string } | null
    user_permission: { permission_level: string; access_level: string } | null
    system_settings_permission: { permission_level: string; access_level: string } | null
    bank_details_permission: { permission_level: string; access_level: string } | null
    roles_permission: { permission_level: string; access_level: string } | null
    access_logs_permission: { permission_level: string; access_level: string } | null
  }
  userProjectRoles?: Array<{
    id: string
    project_type: string
    user_role_id: string
    portfolio_ids: string[]
    subportfolio_ids: string[]
    property_ids: string[]
    is_active: boolean
    user_role: {
      id: string
      name: string
      description: string
      is_external: boolean
      can_access_mis: boolean
      portfolio_permission: { permission_level: string; access_level: string } | null
      property_permission: { permission_level: string; access_level: string } | null
      audit_permission: { permission_level: string; access_level: string } | null
      user_permission: { permission_level: string; access_level: string } | null
      system_settings_permission: { permission_level: string; access_level: string } | null
      bank_details_permission: { permission_level: string; access_level: string } | null
      roles_permission: { permission_level: string; access_level: string } | null
      access_logs_permission: { permission_level: string; access_level: string } | null
    }
    project_role: {
      id: string
      name: string
      project_type: string
    }
  }>
}

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject('IAuthRepository')
    private authRepository: IAuthRepository,
    @Inject(JwtService)
    private jwtService: JwtService,
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>,
    @Inject(EmailUtil)
    private emailUtil: EmailUtil,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async requestLoginOtp(
    email: string,
    password: string
  ): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }

    if (user.temp_password) {
      throw new BadRequestException(
        'Please complete your invitation verification first'
      )
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      user.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials')
    }

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.authRepository.createOtp(user.id, otp, expiresAt)
    await this.emailUtil.sendOtpEmail(email, Number(otp))

    console.log(`Login OTP for ${email}: ${otp}`)

    return { message: 'OTP sent to your email' }
  }

  async verifyLoginOtp(data: VerifyLoginOtpDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }

    const validOtp = await this.authRepository.findValidOtp(user.id, data.otp)

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired OTP')
    }

    await this.authRepository.markOtpAsUsed(validOtp.id)

    const userWithRole = await this.authRepository.findUserByEmail(user.email)
    if (!userWithRole) {
      throw new BadRequestException('User not found')
    }
    return this.generateAuthResponse(userWithRole as unknown as UserWithRole)
  }

  async inviteUser(
    data: InviteUserDto,
    inviterId: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }> {
    // Check if user has permission to invite (permission_level must be 'all')
    if (inviterRolePermissionLevel !== 'all') {
      throw new ForbiddenException(
        'You do not have permission to invite users. Only users with full user management permission can invite.'
      )
    }

    const existingUser = await this.authRepository.findUserByEmail(data.email)

    if (existingUser) {
      throw new ConflictException('User with this email already exists')
    }

    const tempPassword = EncryptionUtil.generateTempPassword()
    const hashedPassword = await EncryptionUtil.hashPassword(tempPassword)
    const expiryDays = this.configService.get('auth.tempPasswordExpiryDays', {
      infer: true
    })!

    const newUser = await this.authRepository.createUser({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
      job_title: data.job_title,
      phone_number: data.phone_number,
      user_role_id: data.role_id,
      password: hashedPassword,
      temp_password: tempPassword,
      is_verified: false,
      invited_by_id: inviterId,
      invitation_sent_at: new Date()
    })

    // Create UserAccessedProperty if portfolio_ids or property_ids are provided
    if ((data.portfolio_ids && data.portfolio_ids.length > 0) || 
        (data.property_ids && data.property_ids.length > 0)) {
      await this.authRepository.createUserAccessedProperties(
        newUser.id,
        data.portfolio_ids || [],
        data.property_ids || []
      )
    }

    // Fetch role details to get is_external flag
    const role = await this.prisma.userRole.findUnique({
      where: { id: data.role_id },
      select: { name: true, is_external: true }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    await this.emailUtil.sendInvitationEmail(
      data.email,
      tempPassword,
      role.name,
      data.first_name,
      role.is_external
    )

    console.log(`Invitation sent to ${data.email}. Temp password: ${tempPassword}`)

    return {
      message: `Invitation sent successfully. Temporary password is valid for ${expiryDays} days.`
    }
  }

  async resendInvitation(
    email: string,
    inviterRolePermissionLevel: string | undefined
  ): Promise<{ message: string }> {
    // Check if user has permission to resend invitation (permission_level must be 'all')
    if (inviterRolePermissionLevel !== 'all') {
      throw new ForbiddenException(
        'You do not have permission to resend invitations. Only users with full user management permission can resend.'
      )
    }

    const user = await this.authRepository.findUserByEmail(email)

    if (!user) {
      throw new BadRequestException('User not found')
    }

    // Check if user has a pending invitation (temp_password exists and is_verified is false)
    if (!user.temp_password || user.is_verified) {
      throw new BadRequestException(
        'No pending invitation found for this user. The user may have already verified their account.'
      )
    }

    // Check 5-minute cooldown
    const COOLDOWN_MINUTES = 5
    if (user.invitation_sent_at) {
      const timeSinceLastInvitation =
        Date.now() - new Date(user.invitation_sent_at).getTime()
      const cooldownMs = COOLDOWN_MINUTES * 60 * 1000

      if (timeSinceLastInvitation < cooldownMs) {
        const remainingSeconds = Math.ceil(
          (cooldownMs - timeSinceLastInvitation) / 1000
        )
        const remainingMinutes = Math.floor(remainingSeconds / 60)
        const remainingSecs = remainingSeconds % 60

        throw new BadRequestException(
          `Please wait ${remainingMinutes}m ${remainingSecs}s before resending the invitation.`
        )
      }
    }

    // Generate new temporary password
    const tempPassword = EncryptionUtil.generateTempPassword()
    const hashedPassword = await EncryptionUtil.hashPassword(tempPassword)
    const expiryDays = this.configService.get('auth.tempPasswordExpiryDays', {
      infer: true
    })!

    // Update user with new temp password and invitation sent timestamp
    await this.authRepository.updateUserPassword(user.id, hashedPassword)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        temp_password: tempPassword,
        invitation_sent_at: new Date()
      }
    })

    // Fetch role details to get is_external flag
    const role = await this.prisma.userRole.findUnique({
      where: { id: user.user_role_id },
      select: { name: true, is_external: true }
    })

    if (!role) {
      throw new Error('Role not found')
    }

    // Send invitation email
    await this.emailUtil.sendInvitationEmail(
      user.email,
      tempPassword,
      role.name,
      user.first_name,
      role.is_external
    )

    console.log(`Invitation resent to ${email}. Temp password: ${tempPassword}`)

    return {
      message: `Invitation resent successfully. Temporary password is valid for ${expiryDays} days.`
    }
  }

  async verifyInvitation(data: VerifyInvitationDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }

    if (!user.temp_password) {
      throw new BadRequestException('No pending invitation found')
    }

    if (user.temp_password !== data.temp_password) {
      throw new BadRequestException('Invalid temporary password')
    }

    const hashedNewPassword = await EncryptionUtil.hashPassword(
      data.new_password
    )
    await this.authRepository.updateUserPassword(user.id, hashedNewPassword)
    await this.authRepository.clearTempPassword(user.id)

    const updatedUser = await this.authRepository.findUserByEmail(data.email)
    if (!updatedUser) {
      throw new BadRequestException('User not found')
    }
    return this.generateAuthResponse(updatedUser as unknown as UserWithRole)
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(email)

    if (!user) {
      return { message: 'If the email exists, an OTP has been sent' }
    }

    const otp = EncryptionUtil.generateOtp()
    const expiryMinutes = this.configService.get('auth.otpExpiryMinutes', {
      infer: true
    })!
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

    await this.authRepository.createOtp(user.id, otp, expiresAt)
    await this.emailUtil.sendPasswordResetOtpEmail(email, Number(otp))

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Password Reset OTP for ${email}: ${otp}`)
    }

    return { message: 'If the email exists, an OTP has been sent' }
  }

  async resetPassword(data: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.authRepository.findUserByEmail(data.email)

    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }

    const validOtp = await this.authRepository.findValidOtp(user.id, data.otp)

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired OTP')
    }

    await this.authRepository.markOtpAsUsed(validOtp.id)

    const hashedNewPassword = await EncryptionUtil.hashPassword(
      data.new_password
    )
    await this.authRepository.updateUserPassword(user.id, hashedNewPassword)

    return { message: 'Password reset successfully' }
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true })
      })

      const user = await this.authRepository.findUserByEmail(payload.email)

      if (!user) {
        throw new UnauthorizedException('Invalid token')
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role_id: user.user_role_id
      }

      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        expiresIn: this.configService.get('jwt.accessExpiresIn', { infer: true })
      })

      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
        expiresIn: this.configService.get('jwt.refreshExpiresIn', { infer: true })
      })

      return { access_token: newAccessToken, refresh_token: newRefreshToken }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }
  }

  private generateAuthResponse(user: UserWithRole): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role_id: user.user_role_id
    }

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.accessExpiresIn', { infer: true })
    })

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', {
        infer: true
      })
    })

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        projectRoles: user.userProjectRoles?.map(pr => ({
          project_type: pr.project_type,
          user_role_id: pr.user_role_id,
          user_role: pr.user_role,
          portfolio_ids: pr.portfolio_ids,
          subportfolio_ids: pr.subportfolio_ids,
          property_ids: pr.property_ids,
          is_active: pr.is_active
        }))
      }
    }
  }

  async createSuperAdmin(data: CreateSuperAdminDto): Promise<AuthResponseDto> {
    // 1. Prevent duplicate super admin account by email
    const existingUser = await this.authRepository.findUserByEmail(data.email)
    if (existingUser) {
      throw new ConflictException('A user with this email already exists')
    }

    // 2. Upsert the Super Admin role with full permissions on all modules
    const SUPER_ADMIN_ROLE_NAME = 'Super Admin'
    const fullPermission = {
      permission_level: PermissionLevel.all,
      access_level: AccessLevel.all
    }

    const superAdminRole = await this.prisma.userRole.upsert({
      where: { name: SUPER_ADMIN_ROLE_NAME },
      update: {
        roles_permission: fullPermission,
        access_logs_permission: fullPermission
      },
      create: {
        name: SUPER_ADMIN_ROLE_NAME,
        description: 'Super Administrator with unrestricted access to all modules',
        is_external: false,
        can_access_mis: true,
        is_active: true,
        order: 0,
        portfolio_permission: fullPermission,
        property_permission: fullPermission,
        audit_permission: fullPermission,
        user_permission: fullPermission,
        system_settings_permission: fullPermission,
        bank_details_permission: fullPermission,
        roles_permission: fullPermission,
        access_logs_permission: fullPermission
      }
    })

    // 3. Guard: prevent a second super admin from being created under this role
    const existingSuperAdminUser = await this.prisma.user.findFirst({
      where: { user_role_id: superAdminRole.id }
    })
    if (existingSuperAdminUser) {
      throw new ConflictException(
        'A Super Admin already exists. Only one Super Admin account is allowed.'
      )
    }

    // 4. Hash the provided password and create a fully verified user
    const hashedPassword = await EncryptionUtil.hashPassword(data.password)

    await this.authRepository.createUser({
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      language: data.language,
      user_role_id: superAdminRole.id,
      password: hashedPassword,
      is_verified: true   // No invitation flow — fully active from creation
    })

    // 5. Fetch the full user (with role) and return auth tokens
    const createdUser = await this.authRepository.findUserByEmail(data.email)
    if (!createdUser) {
      throw new Error('Failed to fetch created super admin user')
    }

    console.log(`[SUPER ADMIN] Created super admin account for: ${data.email}`)

    return this.generateAuthResponse(createdUser as unknown as UserWithRole)
  }
}
