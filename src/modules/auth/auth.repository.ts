import { Inject, Injectable } from '@nestjs/common'
import { Otp, User } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { IAuthRepository, UserWithRole } from './auth.interface'

@Injectable()
export class AuthRepository implements IAuthRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
        userProjectRoles: {
          where: { is_active: true },
          include: {
            user_role: true,
            project_role: true
          }
        }
      }
    })
  }

  async createOtp(userId: string, otp: string, expiresAt: Date): Promise<void> {
    await this.prisma.otp.create({
      data: {
        user_id: userId,
        otp_code: otp,
        expires_at: expiresAt,
        is_used: false
      }
    })
  }

  async findValidOtp(userId: string, otp: string): Promise<Otp | null> {
    return this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        otp_code: otp,
        is_used: false,
        expires_at: {
          gte: new Date()
        }
      }
    })
  }

  async markOtpAsUsed(otpId: string): Promise<void> {
    await this.prisma.otp.update({
      where: { id: otpId },
      data: { is_used: true }
    })
  }

  async createUser(data: {
    email: string
    first_name: string
    last_name: string
    language: string
    user_role_id: string
    password: string
    temp_password?: string
    is_verified: boolean
    invited_by_id?: string
    invitation_sent_at?: Date
    job_title?: string
    phone_number?: string
  }): Promise<User> {
    return this.prisma.user.create({
      data
    })
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { password }
    })
  }

  async clearTempPassword(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { temp_password: null, is_verified: true }
    })
  }

  async updateInvitationSentAt(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { invitation_sent_at: new Date() }
    })
  }

  async createUserAccessedProperties(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    await this.prisma.userAccessedProperty.create({
      data: {
        user_id: userId,
        portfolio_id: portfolioIds,
        property_id: propertyIds
      }
    })
  }
}
