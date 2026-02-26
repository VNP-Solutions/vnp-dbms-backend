import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { UserInvitation } from '@prisma/client'
import { randomBytes } from 'crypto'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type {
  AcceptInvitationDto,
  CreateInvitationDto,
  UpdateInvitationDto
} from './user-invitation.dto'
import type {
  IUserInvitationRepository,
  IUserInvitationService
} from './user-invitation.interface'

@Injectable()
export class UserInvitationService implements IUserInvitationService {
  constructor(
    @Inject('IUserInvitationRepository')
    private readonly invitationRepository: IUserInvitationRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Configuration>,
    private readonly emailUtil: EmailUtil,
    private readonly logger: Logger
  ) {}

  private generateInvitationToken(): string {
    return randomBytes(32).toString('hex')
  }

  async createInvitation(
    inviterId: string,
    data: CreateInvitationDto
  ): Promise<UserInvitation> {
    try {
      const normalizedEmail = data.email.toLowerCase()

      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail }
      })
      if (existingUser) {
        throw new ConflictException('A user with this email already exists')
      }

      const existingInvitation =
        await this.invitationRepository.findPendingByEmail(normalizedEmail)
      if (existingInvitation) {
        throw new ConflictException(
          'A pending invitation for this email already exists'
        )
      }

      const inviter = await this.prisma.user.findUnique({
        where: { id: inviterId },
        select: {
          id: true,
          first_name: true,
          last_name: true
        }
      })

      if (!inviter) {
        throw new NotFoundException('Inviter user not found')
      }

      const invitationToken = this.generateInvitationToken()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const invitation = await this.invitationRepository.create({
        ...data,
        email: normalizedEmail,
        invited_by_id: inviterId,
        invitation_token: invitationToken,
        expires_at: expiresAt
      })

      const inviterName =
        `${inviter.first_name || ''} ${inviter.last_name || ''}`.trim() ||
        'Admin'

      await this.emailUtil.sendTokenInvitationEmail(
        normalizedEmail,
        invitationToken,
        inviterName,
        data.message
      )

      return invitation
    } catch (error) {
      this.logger.error(
        `Error creating invitation: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      )
      throw error
    }
  }

  async getAllInvitations(
    query: Record<string, any>
  ): Promise<{ data: UserInvitation[]; metadata: any }> {
    return this.invitationRepository.findAll(query)
  }

  async getInvitationById(id: string): Promise<UserInvitation> {
    const invitation = await this.invitationRepository.findById(id)
    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }
    return invitation
  }

  async getInvitationByToken(token: string): Promise<UserInvitation> {
    const invitation = await this.invitationRepository.findByToken(token)
    if (!invitation) {
      throw new NotFoundException('Invitation not found')
    }

    if (invitation.status !== 'Pending') {
      throw new BadRequestException('This invitation is no longer valid')
    }

    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('This invitation has expired')
    }

    return invitation
  }

  async updateInvitation(
    id: string,
    data: UpdateInvitationDto
  ): Promise<UserInvitation> {
    await this.getInvitationById(id)
    return this.invitationRepository.update(id, data)
  }

  async deleteInvitation(id: string): Promise<UserInvitation> {
    await this.getInvitationById(id)
    return this.invitationRepository.delete(id)
  }

  async resendInvitation(
    id: string,
    message?: string
  ): Promise<UserInvitation> {
    const invitation = await this.getInvitationById(id)

    if (invitation.status !== 'Pending') {
      throw new BadRequestException('Can only resend pending invitations')
    }

    const newToken = this.generateInvitationToken()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    const updatedInvitation = await this.invitationRepository.update(id, {
      invitation_token: newToken,
      expires_at: newExpiresAt,
      message: message ?? invitation.message
    } as any)

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invited_by_id },
      select: {
        first_name: true,
        last_name: true
      }
    })

    const inviterName =
      `${inviter?.first_name || ''} ${inviter?.last_name || ''}`.trim() ||
      'Admin'

    await this.emailUtil.sendTokenInvitationEmail(
      invitation.email,
      newToken,
      inviterName,
      message ?? invitation.message ?? undefined
    )

    return updatedInvitation
  }

  async acceptInvitation(
    token: string,
    data: AcceptInvitationDto
  ): Promise<{ user: any; invitation: UserInvitation }> {
    const invitation = await this.getInvitationByToken(token)

    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() }
    })

    if (existingUser) {
      throw new ConflictException('A user with this email already exists')
    }

    const hashedPassword = await EncryptionUtil.hashPassword(data.password)

    const user = await this.prisma.user.create({
      data: {
        email: invitation.email.toLowerCase(),
        first_name: data.first_name,
        last_name: data.last_name,
        language: data.language || 'en',
        contact_number: data.contact_number,
        user_role_id: invitation.user_role_id,
        password: hashedPassword,
        is_verified: true,
        invited_by_id: invitation.invited_by_id,
        invitation_sent_at: invitation.created_at
      }
    })

    await this.createUserPermissions(user.id, invitation)

    const updatedInvitation = await this.invitationRepository.markAsAccepted(
      invitation.id,
      user.id
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        language: user.language,
        contact_number: user.contact_number,
        user_role_id: user.user_role_id,
        is_verified: user.is_verified
      },
      invitation: updatedInvitation
    }
  }

  private async createUserPermissions(
    userId: string,
    invitation: UserInvitation
  ): Promise<void> {
    try {
      const permissionEntries: {
        user_id: string
        portfolio_id?: string | null
        subportfolio_id?: string | null
        property_id?: string | null
      }[] = []

      if (invitation.portfolio_ids && invitation.portfolio_ids.length > 0) {
        for (const portfolioId of invitation.portfolio_ids) {
          permissionEntries.push({
            user_id: userId,
            portfolio_id: portfolioId,
            subportfolio_id: null,
            property_id: null
          })
        }
      }

      if (
        invitation.subportfolio_ids &&
        invitation.subportfolio_ids.length > 0
      ) {
        for (const subportfolioId of invitation.subportfolio_ids) {
          permissionEntries.push({
            user_id: userId,
            portfolio_id: null,
            subportfolio_id: subportfolioId,
            property_id: null
          })
        }
      }

      if (invitation.property_ids && invitation.property_ids.length > 0) {
        for (const propertyId of invitation.property_ids) {
          permissionEntries.push({
            user_id: userId,
            portfolio_id: null,
            subportfolio_id: null,
            property_id: propertyId
          })
        }
      }

      if (permissionEntries.length > 0) {
        await this.prisma.userFeatureAccessPermission.createMany({
          data: permissionEntries
        })
        this.logger.log(
          `Created ${permissionEntries.length} feature access permissions for user ${userId}`
        )
      }
    } catch (error) {
      this.logger.error(
        `Error creating user feature permissions: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      )
    }
  }

  async cancelInvitation(id: string): Promise<UserInvitation> {
    const invitation = await this.getInvitationById(id)

    if (invitation.status !== 'Pending') {
      throw new BadRequestException('Can only cancel pending invitations')
    }

    return this.invitationRepository.update(id, {
      status: 'Cancelled' as any
    } as any)
  }
}

