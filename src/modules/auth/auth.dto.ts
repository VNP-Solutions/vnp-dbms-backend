import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    ValidateIf
} from 'class-validator'

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'admin@vnpsolutions.com', description: 'Super admin email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  first_name: string

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  last_name: string

  @ApiProperty({ example: 'en', description: 'Preferred language code' })
  @IsString()
  @IsNotEmpty()
  language: string

  @ApiProperty({
    example: 'Admin@1234!',
    description: 'Password (8-32 chars, must contain letter, number, special char)'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  password: string
}



export class LoginRequestOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: 'MyPassword123!',
    description: 'User password'
  })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class VerifyLoginOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiPropertyOptional({
    example: 'MyPassword123!',
    description:
      'Optional. Ignored during OTP verification; accepted for clients that send the same payload as the request-otp step.'
  })
  @IsOptional()
  @IsString()
  password?: string

  @ApiPropertyOptional({
    example: '123456',
    description: 'Legacy alias for otp'
  })
  @IsOptional()
  @IsString()
  otp_code?: string

  @ApiProperty({
    example: '123456',
    description: '6-digit numeric OTP code'
  })
  @Transform(({ obj, value }: { obj: VerifyLoginOtpDto; value: unknown }) => {
    const raw = value ?? obj.otp_code
    if (raw === undefined || raw === null) {
      return undefined
    }
    return String(raw).trim()
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'OTP must be a 6-digit numeric code'
  })
  otp: string

  @ApiPropertyOptional({
    example: true,
    description:
      'When true (default), auth cookies use configured JWT expiry. When false, uses a shorter browser session (2h access, 18h refresh).'
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined
    }
    if (typeof value === 'boolean') {
      return value
    }
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
    return value
  })
  @IsOptional()
  @IsBoolean()
  keep_sign_in?: boolean
}

export class InviteUserDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'User role ID'
  })
  @IsString()
  @IsNotEmpty()
  role_id: string

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  @IsNotEmpty()
  first_name: string

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsNotEmpty()
  last_name: string

  @ApiProperty({ example: 'en', description: 'Preferred language code' })
  @IsString()
  @IsNotEmpty()
  language: string

  @ApiPropertyOptional({
    example: 'Software Engineer',
    description: 'Job title'
  })
  @IsString()
  @IsOptional()
  job_title?: string

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number'
  })
  @IsString()
  @IsOptional()
  phone_number?: string

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439011'],
    description: 'Array of portfolio IDs user can access'
  })
  @IsArray()
  @IsOptional()
  portfolio_ids?: string[]

  @ApiPropertyOptional({
    example: ['507f1f77bcf86cd799439012'],
    description: 'Array of property IDs user can access'
  })
  @IsArray()
  @IsOptional()
  property_ids?: string[]
}

export class ResendInvitationDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the user to resend invitation to'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class VerifyInvitationDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: 'TempPass123',
    description: 'Temporary password from invitation email'
  })
  @IsString()
  @IsNotEmpty()
  temp_password: string

  @ApiProperty({
    example: 'NewPass123!',
    description:
      'New password (8-32 chars, must contain letter, number, special char)'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  new_password: string
}

export class RequestPasswordResetDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiProperty({
    example: '123456',
    description: '6-digit numeric OTP code'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'OTP must be a 6-digit numeric code'
  })
  otp: string

  @ApiProperty({
    example: 'NewPass123!',
    description:
      'New password (8-32 chars, must contain letter, number, special char)'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    {
      message:
        'Password must be 8-32 characters long and contain at least one letter, one number, and one special character'
    }
  )
  new_password: string
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Optional legacy refresh token in body. Prefer HTTP-only refreshToken cookie.'
  })
  @ValidateIf((o: RefreshTokenDto) => o.refresh_token !== undefined)
  @IsString()
  @IsNotEmpty()
  refresh_token?: string
}

/** User object shape returned in auth responses */
export interface AuthResponseUserDto {
  id: string
  email: string
  first_name: string
  last_name: string
  role: {
    id: string
    name: string
    description: string
    is_external: boolean
    portfolio_permission?: { permission_level: string; access_level: string } | null
    property_permission?: { permission_level: string; access_level: string } | null
    audit_permission?: { permission_level: string; access_level: string } | null
    user_permission?: { permission_level: string; access_level: string } | null
    system_settings_permission?: { permission_level: string; access_level: string } | null
    bank_details_permission?: { permission_level: string; access_level: string } | null
    roles_permission?: { permission_level: string; access_level: string } | null
    access_logs_permission?: { permission_level: string; access_level: string } | null
  }
  projectRoles?: Array<{
    project_type: string
    user_role_id: string
    user_role?: { id: string; name: string; description: string }
    portfolio_ids: string[]
    subportfolio_ids: string[]
    property_ids: string[]
    is_active: boolean
  }>
}

export class AuthResponseDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'JWT access token — included in the response body only when NODE_ENV=development (also set as an HTTP-only cookie for browser clients)'
  })
  access_token?: string

  @ApiProperty({
    example: {
      id: '507f1f77bcf86cd799439011',
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe',
      role: {
        id: '507f1f77bcf86cd799439012',
        name: 'Admin',
        description: 'Administrator role with full access',
        is_external: false,
        user_permission: { permission_level: 'all', access_level: 'all' }
      }
    },
    description: 'Authenticated user information'
  })
  user: AuthResponseUserDto
}
