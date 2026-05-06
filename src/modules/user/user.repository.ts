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

    const users = await this.prisma.user.findMany({
      where,
      skip,
      take,
      orderBy
    })

    const validRoleIds = users.map(u => u.user_role_id).filter(Boolean)

    const [roles, inviters] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { id: { in: validRoleIds } }
      }),
      this.prisma.user.findMany({
        where: {
          id: {
            in: users.map(u => u.invited_by_id).filter(Boolean) as string[]
          }
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true
        }
      })
    ])

    const roleMap = new Map(roles.map(r => [r.id, r]))
    const inviterMap = new Map(inviters.map(i => [i.id, i]))

    return users
      .filter(user => user.user_role_id && roleMap.has(user.user_role_id))
      .map(user => {
        const role = roleMap.get(user.user_role_id)!
        const inviter = user.invited_by_id
          ? inviterMap.get(user.invited_by_id)
          : undefined

        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          language: user.language,
          user_role_id: user.user_role_id,
          is_verified: user.is_verified,
          display_image: user.display_image,
          contact_number: user.contact_number,
          job_title: user.job_title,
          phone_number: user.phone_number,
          created_at: user.created_at,
          updated_at: user.updated_at,
          invited_by_id: user.invited_by_id,
          invitation_sent_at: user.invitation_sent_at,
          role: {
            id: role.id,
            name: role.name,
            description: role.description,
            is_external: role.is_external,
            can_access_mis: role.can_access_mis,
            portfolio_permission: role.portfolio_permission,
            property_permission: role.property_permission,
            audit_permission: role.audit_permission,
            user_permission: role.user_permission,
            system_settings_permission: role.system_settings_permission,
            bank_details_permission: role.bank_details_permission,
            roles_permission: role.roles_permission,
            access_logs_permission: role.access_logs_permission
          },
          invitedBy: inviter || null
        }
      }) as UserWithRole[]
  }

  async count(whereClause: any, _userIds?: string[]): Promise<number> {
    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        user_role_id: true
      }
    })

    const validRoleIds = users.map(u => u.user_role_id).filter(Boolean)

    const roles = await this.prisma.userRole.findMany({
      where: {
        id: { in: validRoleIds }
      },
      select: { id: true }
    })

    const validRoleIdSet = new Set(roles.map(r => r.id))

    return users.filter(
      u => u.user_role_id && validRoleIdSet.has(u.user_role_id)
    ).length
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
        job_title: true,
        phone_number: true,
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
        },
        userAccessedProperties: {
          select: {
            id: true,
            property_id: true,
            portfolio_id: true
          }
        },
        userProjectRoles: {
          where: {
            is_active: true
          },
          select: {
            id: true,
            project_type: true
          }
        }
      }
    })

    return user
  }

  async findUserWithAccessibleResources(id: string) {
    const user = await this.findById(id)

    if (!user) {
      return null
    }

    // Extract property and portfolio IDs from UserAccessedProperty
    const propertyIds =
      (user as any).userAccessedProperties?.flatMap(
        (access: any) => access.property_id
      ) || []
    const portfolioIds =
      (user as any).userAccessedProperties?.flatMap(
        (access: any) => access.portfolio_id
      ) || []

    // Fetch properties and portfolios for UserAccessedProperty
    const [properties, portfolios] = await Promise.all([
      propertyIds.length > 0
        ? this.prisma.property.findMany({
            where: { id: { in: propertyIds } },
            select: {
              id: true,
              name: true,
              portfolio: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: { name: 'asc' }
          })
        : [],
      portfolioIds.length > 0
        ? this.prisma.portfolio.findMany({
            where: { id: { in: portfolioIds } },
            select: {
              id: true,
              name: true,
              serviceType: {
                select: {
                  id: true,
                  type: true
                }
              }
            },
            orderBy: { name: 'asc' }
          })
        : []
    ])

    // Process UserProjectRoles - fetch properties and portfolios for each
    const userProjectRoles = await Promise.all(
      ((user as any).userProjectRoles || []).map(async (upr: any) => {
        const [uprProperties, uprPortfolios] = await Promise.all([
          upr.property_ids && upr.property_ids.length > 0
            ? this.prisma.property.findMany({
                where: { id: { in: upr.property_ids } },
                select: {
                  id: true,
                  name: true,
                  portfolio: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                },
                orderBy: { name: 'asc' }
              })
            : [],
          upr.portfolio_ids && upr.portfolio_ids.length > 0
            ? this.prisma.portfolio.findMany({
                where: { id: { in: upr.portfolio_ids } },
                select: {
                  id: true,
                  name: true,
                  serviceType: {
                    select: {
                      id: true,
                      type: true
                    }
                  }
                },
                orderBy: { name: 'asc' }
              })
            : []
        ])

        return {
          id: upr.id,
          properties: uprProperties,
          portfolios: uprPortfolios
        }
      })
    )

    return {
      user,
      properties,
      portfolios,
      userProjectRoles
    }
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
        job_title: true,
        phone_number: true,
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

  async addUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (existingAccess) {
      const mergedPortfolioIds = [
        ...new Set([...(existingAccess.portfolio_id || []), ...portfolioIds])
      ]
      const mergedPropertyIds = [
        ...new Set([...(existingAccess.property_id || []), ...propertyIds])
      ]

      await this.prisma.userAccessedProperty.update({
        where: { id: existingAccess.id },
        data: {
          portfolio_id: mergedPortfolioIds,
          property_id: mergedPropertyIds
        }
      })
    } else {
      await this.prisma.userAccessedProperty.create({
        data: {
          user_id: userId,
          portfolio_id: portfolioIds,
          property_id: propertyIds
        }
      })
    }
  }

  async revokeUserAccess(
    userId: string,
    portfolioIds: string[],
    propertyIds: string[]
  ): Promise<void> {
    const existingAccess = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId }
    })

    if (!existingAccess) {
      return
    }

    const updatedPortfolioIds = (existingAccess.portfolio_id || []).filter(
      id => !portfolioIds.includes(id)
    )
    const updatedPropertyIds = (existingAccess.property_id || []).filter(
      id => !propertyIds.includes(id)
    )

    await this.prisma.userAccessedProperty.update({
      where: { id: existingAccess.id },
      data: {
        portfolio_id: updatedPortfolioIds,
        property_id: updatedPropertyIds
      }
    })
  }
}
