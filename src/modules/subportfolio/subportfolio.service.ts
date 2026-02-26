import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { CreateSubportfolioDto, SubportfolioQueryDto, UpdateSubportfolioDto } from './subportfolio.dto'
import type {
  ISubportfolioRepository,
  ISubportfolioService,
  SubportfolioWithCounts,
  SubportfolioWithPortfolio
} from './subportfolio.interface'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'

@Injectable()
export class SubportfolioService implements ISubportfolioService {
  constructor(
    @Inject('ISubportfolioRepository')
    private readonly repo: ISubportfolioRepository
  ) {}

  async create(data: CreateSubportfolioDto, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio> {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Subportfolio with this name already exists')
    return this.repo.create(data)
  }

  async findAll(query: SubportfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.repo.getAccessibleSubportfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return {
        data: [],
        metadata: { totalDocuments: 0, currentPage: query.page || 1, totalPages: 0 }
      }
    }

    const additionalFilters: any = {}
    if (query.portfolio_id) additionalFilters.portfolio_id = query.portfolio_id
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
      searchFields: ['name', 'description'],
      filterableFields: ['portfolio_id'],
      sortableFields: ['name', 'created_at', 'updated_at'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const
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
      this.repo.findAll({ where, skip, take, orderBy }),
      this.repo.count(where)
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

  async findOne(id: string, user: IUserWithPermissions): Promise<SubportfolioWithCounts> {
    const accessibleIds = await this.repo.getAccessibleSubportfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Subportfolio not found')
    }
    const sub = await this.repo.findById(id)
    if (!sub) throw new NotFoundException('Subportfolio not found')
    return sub
  }

  async findByPortfolioId(portfolioId: string, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio[]> {
    const portfolioIds = await this.repo.getAccessiblePortfolioIdsForSubportfolio(user.id)
    if (Array.isArray(portfolioIds) && !portfolioIds.includes(portfolioId)) {
      throw new NotFoundException('Portfolio not found or access denied')
    }
    return this.repo.findByPortfolioId(portfolioId)
  }

  async update(id: string, data: UpdateSubportfolioDto, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio> {
    await this.findOne(id, user)
    if (data.name) {
      const existing = await this.repo.findByName(data.name)
      if (existing && existing.id !== id) {
        throw new ConflictException('Subportfolio with this name already exists')
      }
    }
    return this.repo.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
    return { message: 'Subportfolio deleted successfully' }
  }
}
