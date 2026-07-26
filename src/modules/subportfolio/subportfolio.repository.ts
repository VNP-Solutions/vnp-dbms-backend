import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateSubportfolioDto, UpdateSubportfolioDto } from './subportfolio.dto'
import type {
  GlobalFilterSubportfolioRow,
  ISubportfolioRepository,
  SubportfolioWithCounts,
  SubportfolioWithPortfolio
} from './subportfolio.interface'

@Injectable()
export class SubportfolioRepository implements ISubportfolioRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getAccessibleSubportfolioIds(userId: string): Promise<string[] | 'all'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { portfolio_permission: true } } }
    })
    const perm = user?.role?.portfolio_permission
    if (perm?.access_level === 'all') return 'all'

    const perms = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId, subportfolio_id: { not: null } },
      select: { subportfolio_id: true }
    })
    const ids = perms.map((p) => p.subportfolio_id).filter(Boolean) as string[]
    if (ids.length > 0) return [...new Set(ids)]

    const portfolioPerms = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId, portfolio_id: { not: null } },
      select: { portfolio_id: true }
    })
    const portfolioIds = portfolioPerms.map((p) => p.portfolio_id).filter(Boolean) as string[]
    if (portfolioIds.length === 0) return []
    const subs = await this.prisma.subportfolio.findMany({
      where: { portfolio_id: { in: portfolioIds } },
      select: { id: true }
    })
    return subs.map((s) => s.id)
  }

  async getAccessiblePortfolioIdsForSubportfolio(userId: string): Promise<string[] | 'all'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { portfolio_permission: true } } }
    })
    const perm = user?.role?.portfolio_permission
    if (!perm) return []
    if (perm.access_level === 'all') return 'all'
    const perms = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId, portfolio_id: { not: null } },
      select: { portfolio_id: true }
    })
    return [...new Set(perms.map((p) => p.portfolio_id!).filter(Boolean))]
  }

  async create(data: CreateSubportfolioDto): Promise<SubportfolioWithPortfolio> {
    return this.prisma.subportfolio.create({
      data: {
        name: data.name,
        description: data.description,
        portfolio: { connect: { id: data.portfolio_id } }
      },
      include: { portfolio: { select: { id: true, name: true } } }
    }) as Promise<SubportfolioWithPortfolio>
  }

  async findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<SubportfolioWithCounts[]> {
    const { where, skip, take, orderBy } = queryOptions

    // Guard against orphaned subportfolios (MongoDB doesn't enforce FK constraints,
    // so some records may reference a deleted portfolio). Pre-filtering by existing
    // portfolio IDs prevents Prisma's "required relation returned null" error.
    const existingPortfolioIds = await this.prisma.portfolio
      .findMany({ select: { id: true } })
      .then(rows => rows.map(r => r.id))

    const safeWhere = {
      ...where,
      portfolio_id: { in: existingPortfolioIds }
    }

    const list = await this.prisma.subportfolio.findMany({
      where: safeWhere,
      skip,
      take,
      orderBy,
      include: {
        portfolio: { select: { id: true, name: true } },
        _count: { select: { properties: true } }
      }
    })
    return list.map((s) => ({
      ...s,
      total_properties: (s as any)._count?.properties ?? 0,
      _count: undefined
    })) as SubportfolioWithCounts[]
  }

  async count(where: any): Promise<number> {
    // Mirror the same orphan guard so the count matches findAll
    const existingPortfolioIds = await this.prisma.portfolio
      .findMany({ select: { id: true } })
      .then(rows => rows.map(r => r.id))

    return this.prisma.subportfolio.count({
      where: { ...where, portfolio_id: { in: existingPortfolioIds } }
    })
  }

  async findById(id: string): Promise<SubportfolioWithCounts | null> {
    const s = await this.prisma.subportfolio.findUnique({
      where: { id },
      include: {
        portfolio: { select: { id: true, name: true } },
        _count: { select: { properties: true } }
      }
    })
    if (!s) return null
    return {
      ...s,
      total_properties: (s as any)._count?.properties ?? 0,
      _count: undefined
    } as SubportfolioWithCounts
  }

  async findByName(name: string) {
    return this.prisma.subportfolio.findUnique({ where: { name } })
  }

  async findByPortfolioId(portfolioId: string): Promise<SubportfolioWithPortfolio[]> {
    return this.prisma.subportfolio.findMany({
      where: { portfolio_id: portfolioId },
      include: { portfolio: { select: { id: true, name: true } } }
    }) as Promise<SubportfolioWithPortfolio[]>
  }

  async update(id: string, data: UpdateSubportfolioDto): Promise<SubportfolioWithPortfolio> {
    const { portfolio_id, ...rest } = data
    const updateData: any = { ...rest }
    if (portfolio_id) updateData.portfolio = { connect: { id: portfolio_id } }
    return this.prisma.subportfolio.update({
      where: { id },
      data: updateData,
      include: { portfolio: { select: { id: true, name: true } } }
    }) as Promise<SubportfolioWithPortfolio>
  }

  async delete(id: string) {
    return this.prisma.subportfolio.delete({ where: { id } })
  }

  async findAllForGlobalFilter(
    accessibleIds: string[] | 'all'
  ): Promise<GlobalFilterSubportfolioRow[]> {
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) return []
    const where = accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    return this.prisma.subportfolio.findMany({
      where,
      select: { id: true, name: true, portfolio_id: true },
      orderBy: { name: 'asc' }
    })
  }
}
