import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { RedisService } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import type { PaginatedResult } from '../../common/dto/query.dto'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'
import type {
  ImportPortfoliosResult,
  IPortfolioRepository,
  IPortfolioService,
  PortfolioWithCounts
} from './portfolio.interface'
import axios, { AxiosInstance } from 'axios'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'

const CACHE_TTL_ITEM = 5 * 60 * 1000   // 5 minutes for individual records
const CACHE_KEY = (id: string) => `portfolio:${id}`
const ALL_PATTERN = 'portfolio:all:*'
const INTERNAL_PORTFOLIO_NAME = 'Internal Portfolio'

@Injectable()
export class PortfolioService implements IPortfolioService, OnModuleInit {
  private readonly logger = new Logger(PortfolioService.name)
  private readonly scraperClient: AxiosInstance | null
  private readonly dashboardClient: AxiosInstance | null

  constructor(
    @Inject('IPortfolioRepository')
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly config: ConfigService<Configuration, true>
  ) {
    const timeout = this.config.get('syncTimeoutMs', { infer: true }) ?? 15000
    const scrUrl = this.config.get('scraperBackendUrl', { infer: true }) ?? ''
    const scrTok = this.config.get('scraperServiceToken', { infer: true }) ?? ''
    this.scraperClient = scrUrl && scrTok
      ? axios.create({ baseURL: scrUrl, timeout, headers: { 'X-Service-Token': scrTok } })
      : null
    if (!this.scraperClient) this.logger.warn('[sync] scraper disabled — URL/token missing')
    const dashUrl = this.config.get('dashboardBackendUrl', { infer: true }) ?? ''
    const dashTok = this.config.get('dashboardServiceToken', { infer: true }) ?? ''
    this.dashboardClient = dashUrl && dashTok
      ? axios.create({ baseURL: dashUrl, timeout, headers: { 'X-Service-Token': dashTok } })
      : null
    if (!this.dashboardClient) this.logger.warn('[sync] dashboard disabled — URL/token missing')
  }

  async onModuleInit() {
    await this.ensureInternalPortfolio()
  }
  
  private async ensureInternalPortfolio() {
    const existing = await this.prisma.portfolio.findUnique({
      where: { name: INTERNAL_PORTFOLIO_NAME }
    })
    if (existing) return existing
  
    let defaultServiceType = await this.prisma.serviceType.findFirst({
      where: { type: { equals: 'OTA', mode: 'insensitive' } }
    })
  
    if (!defaultServiceType) {
      const maxOrder = await this.prisma.serviceType.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true }
      })
  
      defaultServiceType = await this.prisma.serviceType.create({
        data: {
          type: 'OTA',
          is_active: true,
          order: (maxOrder?.order ?? 0) + 1
        }
      })
    }
  
    return this.prisma.portfolio.create({
      data: {
        name: INTERNAL_PORTFOLIO_NAME,
        service_type_id: defaultServiceType.id,
        is_active: true,
        is_commissionable: false
      }
    })
  }

  private async serviceTypeName(serviceTypeId?: string | null): Promise<string> {
    if (!serviceTypeId) return 'OTA'
    const st = await this.prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { type: true }
    })
    return st?.type ?? 'OTA'
  }

  async create(data: CreatePortfolioDto, _user: IUserWithPermissions) {
    if (data.name.trim().toLowerCase() === INTERNAL_PORTFOLIO_NAME.toLowerCase()) {
      throw new ConflictException(`"${INTERNAL_PORTFOLIO_NAME}" is reserved by the system`)
    }
    const existing = await this.portfolioRepository.findByName(data.name)
    if (existing) throw new ConflictException('Portfolio with this name already exists')
    const portfolio = await this.portfolioRepository.create(data)
    await this.redisService.deleteByPattern(ALL_PATTERN)
    return portfolio
  }

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<PortfolioWithCounts>> {
    this.logger.log(`portfolio:findAll — fetching from MongoDB (no cache)`)

    const accessibleIds = await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      const usePagination = query.page != null && query.limit != null
      return {
        data: [],
        metadata: {
          totalDocuments: 0,
          currentPage: usePagination ? (query.page || 1) : 1,
          totalPages: 0,
          limit: usePagination ? (query.limit || 10) : 0
        }
      }
    }

    const additionalFilters: any = {}
    if (query.service_type_id) additionalFilters.service_type_id = query.service_type_id
    if (query.is_active !== undefined && query.is_active !== 'All') {
      additionalFilters.is_active = query.is_active
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
      nestedFieldMap: {}
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
      this.portfolioRepository.findAll({ where, skip, take, orderBy }),
      this.portfolioRepository.count(where)
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

  async findOne(id: string, user: IUserWithPermissions): Promise<PortfolioWithCounts> {
    const accessibleIds = await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const cacheKey = CACHE_KEY(id)
    const cached = await this.redisService.get<PortfolioWithCounts>(cacheKey)
    if (cached) {
      this.logger.log(`[CACHE HIT] portfolio:findOne — served from Redis (key: ${cacheKey})`)
      return cached
    }
    this.logger.log(`[CACHE MISS] portfolio:findOne — fetching from MongoDB (key: ${cacheKey})`)

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    await this.redisService.set(cacheKey, portfolio, CACHE_TTL_ITEM)
    return portfolio
  }

  async update(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions) {
    const existing = await this.findOne(id, user)
    if (!existing) {
      throw new NotFoundException('Portfolio not found')
    }
    if (existing.name === INTERNAL_PORTFOLIO_NAME) {
      throw new BadRequestException(`"${INTERNAL_PORTFOLIO_NAME}" cannot be updated`)
    }
    if (data.name?.trim().toLowerCase() === INTERNAL_PORTFOLIO_NAME.toLowerCase()) {
      throw new ConflictException(`"${INTERNAL_PORTFOLIO_NAME}" is reserved by the system`)
    }
    const updated = await this.portfolioRepository.update(id, data)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.redisService.deleteByPattern(ALL_PATTERN)
    ])
    return updated
  }

  async updateAndSync(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions) {
    const before = await this.findOne(id, user)   // capture OLD name first
    const updated = await this.update(id, data, user)
    try {
      const newName = updated.name?.trim()
      if (newName && newName !== before.name) {
        await this.fanOutPortfolioUpdate(before.name, newName)
      }
    } catch (e: any) {
      this.logger.error(`[sync] unexpected on portfolio update: ${e?.message ?? e}`)
    }
    return updated
  }
  private async fanOutPortfolioUpdate(oldName: string, newName: string) {
    if (this.scraperClient) {
      try {
        const r = await this.scraperClient.post('/portfolios/sync-update', { oldName, newName })
        this.logger.log(`[sync] scraper portfolio update: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] scraper portfolio update failed: ${e?.message ?? e}`)
      }
    } else {
      this.logger.warn('[sync] scraper disabled, skipping portfolio update sync')
    }
  
    if (this.dashboardClient) {
      try {
        const r = await this.dashboardClient.post('/api/portfolio/sync-update', { oldName, newName })
        this.logger.log(`[sync] dashboard portfolio update: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] dashboard portfolio update failed: ${e?.message ?? e}`)
      }
    } else {
      this.logger.warn('[sync] dashboard disabled, skipping portfolio update sync')
    }
  }

  async remove(id: string, user: IUserWithPermissions) {
    const portfolio = await this.findOne(id, user)
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }
    if (portfolio.name === INTERNAL_PORTFOLIO_NAME) {
      throw new BadRequestException(`"${INTERNAL_PORTFOLIO_NAME}" cannot be deleted`)
    }
    const internalPortfolio = await this.ensureInternalPortfolio()
    const movedProperties = await this.portfolioRepository.reassignPropertiesToPortfolio(
      id,
      internalPortfolio.id
    )
    await this.portfolioRepository.delete(id)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.redisService.deleteByPattern(ALL_PATTERN),
      this.redisService.deleteByPattern('property:all:*')
    ])
    return {
       message: `Portfolio deleted successfully. ${movedProperties} properties were moved to "${INTERNAL_PORTFOLIO_NAME}".`
      }
  }

  async removeAndSync(id: string, user: IUserWithPermissions) {
    const before = await this.findOne(id, user)   // capture name BEFORE deletion
    const result = await this.remove(id, user)
    try {
      await this.fanOutPortfolioDelete(before.name)
    } catch (e: any) {
      this.logger.error(`[sync] unexpected on portfolio delete: ${e?.message ?? e}`)
    }
    return result
  }
  private async fanOutPortfolioDelete(name: string) {
    if (this.scraperClient) {
      try {
        const r = await this.scraperClient.post('/portfolios/sync-delete', { name })
        this.logger.log(`[sync] scraper portfolio delete: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] scraper portfolio delete failed: ${e?.message ?? e}`)
      }
    } else {
      this.logger.warn('[sync] scraper disabled, skipping portfolio delete sync')
    }
  
    if (this.dashboardClient) {
      try {
        const r = await this.dashboardClient.post('/api/portfolio/sync-delete', { name })
        this.logger.log(`[sync] dashboard portfolio delete: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] dashboard portfolio delete failed: ${e?.message ?? e}`)
      }
    } else {
      this.logger.warn('[sync] dashboard disabled, skipping portfolio delete sync')
    }
  }

  async importFromExcel(file: Express.Multer.File, _user: IUserWithPermissions): Promise<ImportPortfoliosResult> {
    const buffer = file.buffer || (file as any).buffer
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('File buffer is empty')
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (!data || data.length === 0) {
      throw new BadRequestException('Excel file is empty or invalid')
    }

    const headers = Object.keys(data[0] as object)
    if (!headers.some((h) => h.toLowerCase().includes('portfolio') && h.toLowerCase().includes('name'))) {
      const hasName = headers.some((h) => h.toLowerCase() === 'portfolio' || h.toLowerCase() === 'name')
      if (!hasName) {
        throw new BadRequestException('Excel must contain "Portfolio" or "Portfolio Name" column')
      }
    }

    const portfolioCol = headers.find(
      (h) => h.toLowerCase() === 'portfolio name' || h.toLowerCase() === 'portfolio'
    ) || 'Portfolio'

    const serviceTypeCol = headers.find(
      (h) => h.toLowerCase().includes('service') && h.toLowerCase().includes('type')
    ) || 'Service Type'

    // Find or create default "OTA" service type and resolve to ID
    let defaultServiceType = await this.prisma.serviceType.findFirst({
      where: { type: { equals: 'OTA', mode: 'insensitive' } }
    })

    if (!defaultServiceType) {
      this.logger.log('Default "OTA" service type not found, creating it...')
      const maxOrder = await this.prisma.serviceType.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true }
      })
      defaultServiceType = await this.prisma.serviceType.create({
        data: {
          type: 'OTA',
          is_active: true,
          order: (maxOrder?.order ?? 0) + 1
        }
      })
      this.logger.log('Default "OTA" service type created successfully')
    }


    let portfoliosCreated = 0
    const portfolios: any[] = []
    const skipped_portfolios: any[] = []
    const portfolioNames = [
      ...new Set(
        data
          .map((row) => {
            const val = (row as any)[portfolioCol]
            return val && String(val).trim() ? String(val).trim() : null
          })
          .filter(Boolean)
      )
    ] as string[]

    this.logger.log(`Processing ${portfolioNames.length} unique portfolios from ${data.length} rows`)

    for (const name of portfolioNames) {
      const rowIndex = data.findIndex((r) => String((r as any)[portfolioCol]).trim() === name)
      const row_no = rowIndex >= 0 ? rowIndex + 2 : 0 // +2 accounting for 0-index and header row

      try {
        const existing = await this.portfolioRepository.findByName(name)
        if (existing) {
          this.logger.debug(`Portfolio "${name}" already exists, skipping`)
          skipped_portfolios.push({
            row_no,
            portfolio_name: name,
            reason: 'Portfolio already exists'
          })
          continue
        }

        const row = data[rowIndex] as any

        let service_type_id: string = defaultServiceType.id

        if (row?.[serviceTypeCol]) {
          const stName = String(row[serviceTypeCol]).trim()
          let st = await this.prisma.serviceType.findFirst({
            where: { type: { equals: stName, mode: 'insensitive' } }
          })
          if (!st) {
            this.logger.log(
              `ServiceType "${stName}" not found for portfolio "${name}" — creating it`
            )
            const maxOrder = await this.prisma.serviceType.findFirst({
              orderBy: { order: 'desc' },
              select: { order: true }
            })
            st = await this.prisma.serviceType.create({
              data: {
                type: stName,
                is_active: true,
                order: (maxOrder?.order ?? 0) + 1
              }
            })
            this.logger.log(`ServiceType "${stName}" created successfully`)
          }
          service_type_id = st.id
        }

        const valActive = row?.['Active status']
        const is_active = valActive !== undefined
          ? ['active', 'yes', 'true', '1'].includes(String(valActive).toLowerCase().trim())
          : true

        const valCommissionable = row?.['Commissionable']
        const is_commissionable = valCommissionable !== undefined
          ? ['yes', 'true', '1'].includes(String(valCommissionable).toLowerCase().trim())
          : false

        const valContractSigned = row?.['Contract Signed']
        const contract_signed = valContractSigned !== undefined
          ? ['yes', 'true', '1'].includes(String(valContractSigned).toLowerCase().trim())
          : undefined

        const dto: CreatePortfolioDto = {
          name,
          service_type_id,
          is_active,
          is_commissionable,
          contact_email: row?.['Contact Email'] ? String(row['Contact Email']).trim() : undefined,
          portfolio_contact_email: row?.['Portfolio Contact Email']
            ? String(row['Portfolio Contact Email']).trim()
            : undefined,
          portfolio_contact_name: row?.['Portfolio Contact Name']
            ? String(row['Portfolio Contact Name']).trim()
            : undefined,
          portfolio_contact_phone: row?.['Portfolio Contact Phone']
            ? String(row['Portfolio Contact Phone']).trim()
            : undefined,
          commission: row?.['Commission'] != null ? Number(row['Commission']) : undefined,
          attachment: row?.['Documents'] ? String(row['Documents']).trim() : undefined,
          attachments: row?.['Attachments']
            ? String(row['Attachments'])
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
          contract_signed
        }

        const created = await this.portfolioRepository.create(dto)
        portfolios.push(created)
        portfoliosCreated++
        this.logger.log(`Created portfolio: ${name}`)
      } catch (err: any) {
        this.logger.error(`Error creating portfolio "${name}": ${err.message}`)
        skipped_portfolios.push({
          row_no,
          portfolio_name: name,
          reason: `Error: ${err.message}`
        })
        continue
      }
    }

    await this.redisService.deleteByPattern(ALL_PATTERN)
    return { portfoliosCreated, portfolios, skipped_portfolios }
  }

  async findAllCached(user: IUserWithPermissions): Promise<PortfolioWithCounts[]> {
    const cacheKey = `portfolio:all:${user.id}`
    const cached = await this.redisService.get<PortfolioWithCounts[]>(cacheKey)
    if (cached) {
      this.logger.log(`[CACHE HIT] portfolio:findAllCached — served from Redis (key: ${cacheKey})`)
      return cached
    }
    this.logger.log(`[CACHE MISS] portfolio:findAllCached — fetching from MongoDB (key: ${cacheKey})`)

    const accessibleIds = await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    const where = accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    const data = await this.portfolioRepository.findAll({ where, orderBy: { created_at: 'desc' } })

    // TTL 0 = no expiry; invalidated explicitly on every write operation
    await this.redisService.set(cacheKey, data, 0)
    return data
  }

  private hashQuery(query: object): string {
    return createHash('sha256').update(JSON.stringify(query)).digest('hex').substring(0, 16)
  }

  private async fanOutPortfolioCreate(p: {
    name: string
    service_type_id?: string | null
    is_active?: boolean
    is_commissionable?: boolean
    contact_email?: string | null
  }) {
    if (this.scraperClient) {
      try {
        const r = await this.scraperClient.post('/portfolios/sync-create', { name: p.name })
        this.logger.log(`[sync] scraper portfolio create: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] scraper portfolio create failed: ${e?.message ?? e}`)
      }
    }
  
    if (this.dashboardClient) {
      const payload = {
        name: p.name,
        service_type: await this.serviceTypeName(p.service_type_id),
        is_active: p.is_active,
        is_commissionable: p.is_commissionable,
        contact_email: p.contact_email ?? null
      }
      try {
        const r = await this.dashboardClient.post('/api/portfolio/sync-create', payload)
        this.logger.log(`[sync] dashboard portfolio create: ${JSON.stringify(r.data)}`)
      } catch (e: any) {
        this.logger.error(`[sync] dashboard portfolio create failed: ${e?.message ?? e}`)
      }
    }
  }
  
  async createAndSync(data: CreatePortfolioDto, user: IUserWithPermissions) {
    const portfolio = await this.create(data, user)
    try {
      await this.fanOutPortfolioCreate(portfolio)
    } catch (e: any) {
      this.logger.error(`[sync] unexpected on portfolio create: ${e?.message ?? e}`)
    }
    return portfolio
  }
}
