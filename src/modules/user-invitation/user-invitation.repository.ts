import { Injectable } from '@nestjs/common'
import { InvitationStatus, type UserInvitation } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  CreateInvitationDto,
  UpdateInvitationDto
} from './user-invitation.dto'
import type { IUserInvitationRepository } from './user-invitation.interface'

@Injectable()
export class UserInvitationRepository implements IUserInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: CreateInvitationDto & {
      invited_by_id: string
      invitation_token: string
      expires_at: Date
    }
  ): Promise<UserInvitation> {
    return this.prisma.userInvitation.create({
      data,
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      }
    })
  }

  async findById(id: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findUnique({
      where: { id },
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      }
    })
  }

  async findByToken(token: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findUnique({
      where: { invitation_token: token },
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      }
    })
  }

  async findByEmail(email: string): Promise<UserInvitation[]> {
    return this.prisma.userInvitation.findMany({
      where: { email },
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      },
      orderBy: { created_at: 'desc' }
    })
  }

  async findAll(
    query: Record<string, any>
  ): Promise<{ data: UserInvitation[]; metadata: any }> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 10
    const skip = (page - 1) * limit

    const where: any = {}

    if (query.status) {
      where.status = query.status
    }

    if (query.role) {
      where.role = query.role
    }

    if (query.user_role_id) {
      where.user_role_id = query.user_role_id
    }

    if (query.search) {
      const search = String(query.search)
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { invitedBy: { first_name: { contains: search, mode: 'insensitive' } } },
        { invitedBy: { last_name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.userInvitation.findMany({
        where,
        include: {
          invitedBy: true,
          invitedUser: true,
          userRole: true
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      }),
      this.prisma.userInvitation.count({ where })
    ])

    return {
      data,
      metadata: {
        totalDocuments: total,
        currentPage: page,
        totalPage: Math.ceil(total / limit),
        limit
      }
    }
  }

  async update(id: string, data: UpdateInvitationDto): Promise<UserInvitation> {
    return this.prisma.userInvitation.update({
      where: { id },
      data,
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      }
    })
  }

  async delete(id: string): Promise<UserInvitation> {
    return this.prisma.userInvitation.delete({
      where: { id }
    })
  }

  async findPendingByEmail(email: string): Promise<UserInvitation | null> {
    return this.prisma.userInvitation.findFirst({
      where: {
        email,
        status: InvitationStatus.Pending,
        expires_at: {
          gt: new Date()
        }
      },
      include: {
        invitedBy: true,
        userRole: true
      }
    })
  }

  async markAsAccepted(id: string, userId: string): Promise<UserInvitation> {
    return this.prisma.userInvitation.update({
      where: { id },
      data: {
        status: InvitationStatus.Accepted,
        invited_user_id: userId,
        accepted_at: new Date()
      },
      include: {
        invitedBy: true,
        invitedUser: true,
        userRole: true
      }
    })
  }
}

