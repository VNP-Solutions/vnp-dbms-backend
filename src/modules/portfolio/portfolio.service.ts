import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioRepository, IPortfolioService, PortfolioWithCounts } from './portfolio.interface'

@Injectable()
export class PortfolioService implements IPortfolioService {
  constructor(
    @Inject('IPortfolioRepository')
    private readonly portfolioRepository: IPortfolioRepository
  ) {}

  async create(data: CreatePortfolioDto, user: IUserWithPermissions) {
    const existing = await this.portfolioRepository.findByName(data.name)
    if (existing) throw new ConflictException('Portfolio with this name already exists')
    if (data.is_commissionable && !data.sales_agent) {
      throw new BadRequestException('Sales agent is required when portfolio is commissionable')
    }
    return this.portfolioRepository.create(data)
  }

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return {
        data: [],
        metadata: { totalDocuments: 0, currentPage: query.page || 1, totalPages: 0 }
      }
    }

    const additionalFilters: any = {}
    if (query.service_type_id) additionalFilters.service_type_id = query.service_type_id
    if (query.is_active !== undefined) {
      additionalFilters.is_active = query.is_active === true
    }
    if (query.start_date && query.end_date) {
      additionalFilters.created_at = {
        gte: new Date(query.start_date),
        lte: new Date(query.end_date)
      }
    }

    const mergedQuery = {
      ...query,
      filters: { ...(typeof query.filters === 'object' ? query.filters : {}), ...additionalFilters }
    }

    const queryConfig = {
      searchFields: ['name'],
      filterableFields: ['service_type_id', 'is_active'],
      sortableFields: ['name', 'created_at', 'updated_at', 'is_active', 'is_commissionable'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: { service_type_name: 'serviceType.type' }
    }

    const baseWhere =
      accessibleIds === 'all'
        ? {}
        : { id: { in: accessibleIds } }

    const { where, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll({ where, skip, take, orderBy }),
      this.portfolioRepository.count(where)
    ])

    const totalPages = Math.ceil(total / (take || 10)) || 1
    return {
      data,
      metadata: {
        totalDocuments: total,
        currentPage: query.page || 1,
        totalPages
      }
    }
  }

  async findOne(id: string, user: IUserWithPermissions): Promise<PortfolioWithCounts> {
    const accessibleIds = await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }
    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')
    return portfolio
  }

  async update(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions) {
    await this.findOne(id, user)
    if (data.name) {
      const existing = await this.portfolioRepository.findByName(data.name)
      if (existing && existing.id !== id) {
        throw new ConflictException('Portfolio with this name already exists')
      }
    }
    const current = await this.portfolioRepository.findById(id)
    const isCommissionable = data.is_commissionable !== undefined ? data.is_commissionable : current?.is_commissionable
    const salesAgent = data.sales_agent !== undefined ? data.sales_agent : current?.sales_agent
    if (isCommissionable && !salesAgent) {
      throw new BadRequestException('Sales agent is required when portfolio is commissionable')
    }
    return this.portfolioRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const portfolio = await this.findOne(id, user)
    const count = await this.portfolioRepository.countProperties(id)
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete portfolio with ${count} associated properties. Delete or reassign properties first.`
      )
    }
    await this.portfolioRepository.delete(id)
    return { message: 'Portfolio deleted successfully' }
  }
}
