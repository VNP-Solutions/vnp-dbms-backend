import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { CreateSubportfolioDto, SubportfolioQueryDto, UpdateSubportfolioDto } from './subportfolio.dto'
import type {
  GlobalFilterSubportfolioRow,
  ISubportfolioRepository,
  ISubportfolioService,
  SubportfolioWithCounts,
  SubportfolioWithPortfolio
} from './subportfolio.interface'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { GlobalFilterCacheService } from '../../common/services/global-filter-cache.service'
import { RedisService } from '../redis/redis.service'

const SUBPORTFOLIO_ALL_PATTERN = 'subportfolio:all:*'

@Injectable()
export class SubportfolioService implements ISubportfolioService {
  private readonly logger = new Logger(SubportfolioService.name)

  constructor(
    @Inject('ISubportfolioRepository')
    private readonly repo: ISubportfolioRepository,
    private readonly redisService: RedisService,
    private readonly globalFilterCache: GlobalFilterCacheService
  ) {}

  private async invalidateSubportfolioCache(): Promise<void> {
    await this.globalFilterCache.invalidateAll()
  }

  async findAllCachedForGlobalFilter(
    user: IUserWithPermissions
  ): Promise<GlobalFilterSubportfolioRow[]> {
    const cacheKey = `subportfolio:all:${user.id}`
    const cached = await this.redisService.get<GlobalFilterSubportfolioRow[]>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] subportfolio:findAllCachedForGlobalFilter — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] subportfolio:findAllCachedForGlobalFilter — fetching from MongoDB (key: ${cacheKey})`
    )

    const accessibleIds = await this.repo.getAccessibleSubportfolioIds(user.id)
    const data = await this.repo.findAllForGlobalFilter(accessibleIds)

    // TTL 0 = no expiry; invalidated explicitly on every write operation
    await this.redisService.set(cacheKey, data, 0)
    return data
  }

  async create(data: CreateSubportfolioDto, _user: IUserWithPermissions): Promise<SubportfolioWithPortfolio> {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Subportfolio with this name already exists')
    const subportfolio = await this.repo.create(data)
    await this.invalidateSubportfolioCache()
    return subportfolio
  }

  async findAll(query: SubportfolioQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.repo.getAccessibleSubportfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      const usePagination = query.page != null && query.limit != null
      return {
        data: [],
        metadata: {
          totalDocuments: 0,
          currentPage: 1,
          totalPages: 0,
          limit: usePagination ? (query.limit || 10) : 0
        }
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

    const { where, skip, take, orderBy, usePagination } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

    const [data, total] = await Promise.all([
      this.repo.findAll({ where, skip, take, orderBy }),
      this.repo.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? (query.page || 1) : 1
    const limit = usePagination ? (take || 10) : data.length
    return {
      data,
      metadata: {
        totalDocuments: total,
        currentPage,
        totalPages,
        limit
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
    const subportfolio = await this.repo.update(id, data)
    await this.invalidateSubportfolioCache()
    return subportfolio
  }

  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
    await this.invalidateSubportfolioCache()
    return { message: 'Subportfolio deleted successfully' }
  }
}
