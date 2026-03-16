import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProjectType } from '@prisma/client'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { getProjectAccessibleResources } from '../../common/utils/project-context.util'
import type { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type { ExternalApiQueryDto, ExternalPortfolioDto } from './external-api.dto'

@Injectable()
export class ExternalPortfolioService {
  private readonly encryptionSecret: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Configuration, true>
  ) {
    this.encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })
  }

  async findAllForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    query: ExternalApiQueryDto
  ): Promise<ExternalPortfolioDto[]> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    let portfolioIds: string[] = []
    if (accessibleResources.portfolio_ids === 'all') {
      portfolioIds = []
    } else if (Array.isArray(accessibleResources.portfolio_ids)) {
      portfolioIds = accessibleResources.portfolio_ids
    }

    if (query.portfolio_ids && query.portfolio_ids.length > 0) {
      if (portfolioIds.length > 0) {
        portfolioIds = portfolioIds.filter(id => query.portfolio_ids!.includes(id))
      } else {
        portfolioIds = query.portfolio_ids
      }
    }

    const where: any = {}
    if (portfolioIds.length > 0) {
      where.id = { in: portfolioIds }
    }
    if (query.is_active !== undefined) {
      where.is_active = query.is_active
    }

    const portfolios = await this.prisma.portfolio.findMany({
      where,
      include: {
        serviceType: {
          select: {
            id: true,
            type: true
          }
        },
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        subportfolios: {
          select: { id: true }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    return portfolios.map(portfolio => ({
      id: portfolio.id,
      name: portfolio.name,
      service_type_id: portfolio.service_type_id,
      service_type: {
        id: portfolio.serviceType.id,
        type: portfolio.serviceType.type
      },
      currency_id: portfolio.currency_id,
      currency: {
        id: portfolio.currency.id,
        code: portfolio.currency.code,
        name: portfolio.currency.name,
        symbol: portfolio.currency.symbol || undefined
      },
      is_active: portfolio.is_active,
      contact_email: portfolio.contact_email || undefined,
      portfolio_contact_email: portfolio.portfolio_contact_email || undefined,
      portfolio_contact_name: portfolio.portfolio_contact_name || undefined,
      portfolio_contact_phone: portfolio.portfolio_contact_phone || undefined,
      is_commissionable: portfolio.is_commissionable,
      sales_agent: portfolio.sales_agent || undefined,
      access_email: portfolio.access_email || undefined,
      access_phone: portfolio.access_phone || undefined,
      attachment: portfolio.attachment || undefined,
      created_at: portfolio.created_at.toISOString(),
      updated_at: portfolio.updated_at.toISOString(),
      total_properties: portfolio.properties.length,
      total_subportfolios: portfolio.subportfolios.length
    }))
  }

  async findOneForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    portfolioId: string,
    _includeCredentials = true
  ): Promise<ExternalPortfolioDto | null> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    if (
      accessibleResources.portfolio_ids !== 'all' &&
      !accessibleResources.portfolio_ids.includes(portfolioId)
    ) {
      return null
    }

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        serviceType: {
          select: {
            id: true,
            type: true
          }
        },
        currency: {
          select: {
            id: true,
            code: true,
            name: true,
            symbol: true
          }
        },
        subportfolios: {
          select: { id: true }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    if (!portfolio) {
      return null
    }

    return {
      id: portfolio.id,
      name: portfolio.name,
      service_type_id: portfolio.service_type_id,
      service_type: {
        id: portfolio.serviceType.id,
        type: portfolio.serviceType.type
      },
      currency_id: portfolio.currency_id,
      currency: {
        id: portfolio.currency.id,
        code: portfolio.currency.code,
        name: portfolio.currency.name,
        symbol: portfolio.currency.symbol || undefined
      },
      is_active: portfolio.is_active,
      contact_email: portfolio.contact_email || undefined,
      portfolio_contact_email: portfolio.portfolio_contact_email || undefined,
      portfolio_contact_name: portfolio.portfolio_contact_name || undefined,
      portfolio_contact_phone: portfolio.portfolio_contact_phone || undefined,
      is_commissionable: portfolio.is_commissionable,
      sales_agent: portfolio.sales_agent || undefined,
      access_email: portfolio.access_email || undefined,
      access_phone: portfolio.access_phone || undefined,
      attachment: portfolio.attachment || undefined,
      created_at: portfolio.created_at.toISOString(),
      updated_at: portfolio.updated_at.toISOString(),
      total_properties: portfolio.properties.length,
      total_subportfolios: portfolio.subportfolios.length
    }
  }
}
