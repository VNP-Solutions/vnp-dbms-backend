import { Injectable } from '@nestjs/common'
import { ProjectType } from '@prisma/client'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { getProjectAccessibleResources } from '../../common/utils/project-context.util'
import { PrismaService } from '../prisma/prisma.service'
import type {
  ExternalApiQueryDto,
  ExternalSubportfolioDto
} from './external-api.dto'

@Injectable()
export class ExternalSubportfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    query: ExternalApiQueryDto
  ): Promise<ExternalSubportfolioDto[]> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    const where: any = {}

    if (accessibleResources.subportfolio_ids !== 'all') {
      if (accessibleResources.subportfolio_ids.length === 0) {
        return []
      }
      where.id = { in: accessibleResources.subportfolio_ids }
    }

    if (accessibleResources.portfolio_ids !== 'all') {
      if (accessibleResources.portfolio_ids.length === 0) {
        return []
      }
      where.portfolio_id = { in: accessibleResources.portfolio_ids }
    }

    if (query.portfolio_ids && query.portfolio_ids.length > 0) {
      where.portfolio_id = { in: query.portfolio_ids }
    }

    if (query.subportfolio_ids && query.subportfolio_ids.length > 0) {
      if (where.id) {
        where.id.in = where.id.in.filter((id: string) =>
          query.subportfolio_ids!.includes(id)
        )
      } else {
        where.id = { in: query.subportfolio_ids }
      }
    }

    const subportfolios = await this.prisma.subportfolio.findMany({
      where,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    return subportfolios.map(sub => ({
      id: sub.id,
      name: sub.name,
      portfolio_id: sub.portfolio.id,
      portfolio_name: sub.portfolio.name,
      description: sub.description || undefined,
      is_active: true,
      total_properties: sub.properties.length
    }))
  }

  async findOneForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    subportfolioId: string
  ): Promise<ExternalSubportfolioDto | null> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    if (
      accessibleResources.subportfolio_ids !== 'all' &&
      !accessibleResources.subportfolio_ids.includes(subportfolioId)
    ) {
      return null
    }

    const subportfolio = await this.prisma.subportfolio.findUnique({
      where: { id: subportfolioId },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    if (!subportfolio) {
      return null
    }

    if (
      accessibleResources.portfolio_ids !== 'all' &&
      !accessibleResources.portfolio_ids.includes(subportfolio.portfolio_id)
    ) {
      return null
    }

    return {
      id: subportfolio.id,
      name: subportfolio.name,
      portfolio_id: subportfolio.portfolio.id,
      portfolio_name: subportfolio.portfolio.name,
      description: subportfolio.description || undefined,
      is_active: true,
      total_properties: subportfolio.properties.length
    }
  }

  async findByPortfolioForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    portfolioId: string
  ): Promise<ExternalSubportfolioDto[]> {
    return this.findAllForExternalProject(user, projectType, {
      portfolio_ids: [portfolioId]
    })
  }
}
