import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePortfolioDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioRepository, PortfolioWithCounts, PortfolioWithServiceType } from './portfolio.interface'

@Injectable()
export class PortfolioRepository implements IPortfolioRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getAccessiblePortfolioIds(userId: string): Promise<string[] | 'all'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: {
            portfolio_permission: true
          }
        }
      }
    })
    const permission = user?.role?.portfolio_permission
    if (!permission) return []
    if (permission.access_level === 'all') return 'all'
    if (permission.access_level === 'partial') {
      const perms = await this.prisma.userFeatureAccessPermission.findMany({
        where: { user_id: userId, portfolio_id: { not: null } },
        select: { portfolio_id: true }
      })
      const ids = perms.map((p) => p.portfolio_id).filter(Boolean) as string[]
      return [...new Set(ids)]
    }
    return []
  }

  async create(data: CreatePortfolioDto): Promise<PortfolioWithServiceType> {
    const { service_type_id, ...rest } = data
    
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id: service_type_id }
    })
    
    if (!serviceType) {
      throw new Error(`ServiceType with ID ${service_type_id} not found`)
    }

    const createData: any = {
      ...rest,
      serviceType: { connect: { id: service_type_id } }
    }

    return this.prisma.portfolio.create({
      data: createData,
      include: {
        serviceType: { select: { id: true, type: true, is_active: true } }
      }
    }) as Promise<PortfolioWithServiceType>
  }

  async findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PortfolioWithCounts[]> {
    const { where, skip, take, orderBy } = queryOptions
    const portfolios = await this.prisma.portfolio.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        serviceType: { select: { id: true, type: true, is_active: true } },
        _count: {
          select: { properties: true, subportfolios: true }
        }
      }
    })
    return portfolios.map((p) => ({
      ...p,
      total_properties: (p as any)._count?.properties ?? 0,
      total_subportfolios: (p as any)._count?.subportfolios ?? 0,
      _count: undefined
    })) as PortfolioWithCounts[]
  }

  async count(where: any): Promise<number> {
    return this.prisma.portfolio.count({ where })
  }

  async findById(id: string): Promise<PortfolioWithCounts | null> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id },
      include: {
        serviceType: { select: { id: true, type: true, is_active: true } },
        _count: { select: { properties: true, subportfolios: true } }
      }
    })
    if (!portfolio) return null
    return {
      ...portfolio,
      total_properties: (portfolio as any)._count?.properties ?? 0,
      total_subportfolios: (portfolio as any)._count?.subportfolios ?? 0,
      _count: undefined
    } as PortfolioWithCounts
  }

  async findByName(name: string) {
    return this.prisma.portfolio.findUnique({ where: { name } })
  }

  async update(id: string, data: UpdatePortfolioDto): Promise<PortfolioWithServiceType> {
    const { service_type_id, is_active, ...rest } = data
    const updateData: any = { ...rest }
    
    if (service_type_id) {
      const serviceType = await this.prisma.serviceType.findUnique({
        where: { id: service_type_id }
      })
      
      if (!serviceType) {
        throw new Error(`ServiceType with ID ${service_type_id} not found`)
      }
      
      updateData.serviceType = { connect: { id: service_type_id } }
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active
    }

    return this.prisma.portfolio.update({
      where: { id },
      data: updateData,
      include: {
        serviceType: { select: { id: true, type: true, is_active: true } }
      }
    }) as Promise<PortfolioWithServiceType>
  }

  async delete(id: string) {
    return this.prisma.portfolio.delete({ where: { id } })
  }

  async countProperties(portfolioId: string): Promise<number> {
    return this.prisma.property.count({ where: { portfolio_id: portfolioId } })
  }
}
