import { Inject, Injectable } from '@nestjs/common'
import { User } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  IUserRepository,
  UserWithDetails,
  UserWithRole
} from './user.interface'

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(
    queryOptions: any,
    _userIds?: string[]
  ): Promise<UserWithRole[]> {
    const { where, skip, take, orderBy } = queryOptions

    return this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        invited_by_id: true,
        invitation_sent_at: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            can_access_mis: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true,
            bank_details_permission: true,
            roles_permission: true,
            access_logs_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async count(whereClause: any, _userIds?: string[]): Promise<number> {
    return this.prisma.user.count({
      where: whereClause
    })
  }

  async findById(id: string): Promise<UserWithDetails | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        invited_by_id: true,
        invitation_sent_at: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            can_access_mis: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true,
            bank_details_permission: true,
            roles_permission: true,
            access_logs_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })

    return user
  }

  async update(id: string, data: Partial<User>): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        language: true,
        user_role_id: true,
        is_verified: true,
        display_image: true,
        contact_number: true,
        created_at: true,
        updated_at: true,
        invited_by_id: true,
        invitation_sent_at: true,
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_external: true,
            can_access_mis: true,
            portfolio_permission: true,
            property_permission: true,
            audit_permission: true,
            user_permission: true,
            system_settings_permission: true,
            bank_details_permission: true,
            roles_permission: true,
            access_logs_permission: true
          }
        },
        invitedBy: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true
          }
        }
      }
    })
  }

  async updateRole(id: string, roleId: string): Promise<UserWithRole> {
    return this.update(id, { user_role_id: roleId })
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id }
    })
  }

  async findRoleById(roleId: string) {
    return this.prisma.userRole.findUnique({
      where: { id: roleId }
    })
  }
}
