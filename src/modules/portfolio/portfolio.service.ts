import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
    OnModuleInit
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios, { AxiosInstance } from 'axios'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { GlobalFilterCacheService } from '../../common/services/global-filter-cache.service'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { SyncActionLogWriter } from '../../common/services/sync-action-log-writer.service'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import {
  SYNC_HTTP_TIMEOUT_MS,
  UPLOAD_JOB_HTTP_TIMEOUT_MS,
  type Configuration
} from '../../config/configuration'
import type { UploadAndCreateFileDto } from '../file-upload/file-upload.dto'
import type { IFileUploadService } from '../file-upload/file-upload.interface'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import {
    CreatePortfolioDto,
    PortfolioQueryDto,
    UpdatePortfolioDto
} from './portfolio.dto'
import type {
    ImportPortfoliosResult,
    IPortfolioRepository,
    IPortfolioService,
    PortfolioContact,
    PortfolioWithCounts
} from './portfolio.interface'

const CACHE_TTL_ITEM = 5 * 60 * 1000 // 5 minutes for individual records
const CACHE_KEY = (id: string) => `portfolio:${id}`
const ALL_PATTERN = 'portfolio:all:*'
const INTERNAL_PORTFOLIO_NAME = 'Internal Portfolio'

@Injectable()
export class PortfolioService implements IPortfolioService, OnModuleInit {
  private readonly logger = new Logger(PortfolioService.name)
  private readonly dashboardClient: AxiosInstance | null
  private readonly scraperClient: AxiosInstance | null

  constructor(
    @Inject('IPortfolioRepository')
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject('IFileUploadService')
    private readonly fileUploadService: IFileUploadService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly globalFilterCache: GlobalFilterCacheService,
    private readonly config: ConfigService<Configuration, true>,
    private readonly syncCommunication: SyncCommunicationService,
    private readonly syncActionLogWriter: SyncActionLogWriter
  ) {
    const timeout = SYNC_HTTP_TIMEOUT_MS
    const dashUrl =
      this.config.get('dashboardBackendUrl', { infer: true }) ?? ''
    const scrUrl = this.config.get('scraperBackendUrl', { infer: true }) ?? ''
    const syncAuthReady = this.syncCommunication.isConfigured()

    this.dashboardClient =
      dashUrl && syncAuthReady
        ? this.createExternalJwtSyncClient(dashUrl, timeout)
        : null
    this.scraperClient =
      scrUrl && syncAuthReady
        ? this.createExternalJwtSyncClient(scrUrl, timeout)
        : null

    if (!syncAuthReady) {
      this.logger.warn(
        '[sync] portfolio sync disabled — JWT_COMMUNICATION_SECRET missing'
      )
    }
    if (!this.dashboardClient) {
      this.logger.warn(
        '[sync] dashboard portfolio sync disabled — URL missing or auth not configured'
      )
    }
    if (!this.scraperClient) {
      this.logger.warn(
        '[sync] scraper portfolio sync disabled — URL missing or auth not configured'
      )
    }
  }

  /** Axios client that signs a fresh external-communication JWT on every request. */
  private createExternalJwtSyncClient(
    baseURL: string,
    timeout: number
  ): AxiosInstance {
    const client = axios.create({ baseURL, timeout })
    client.interceptors.request.use(config => {
      Object.assign(config.headers, this.syncCommunication.createAuthHeaders())
      return config
    })
    return client
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

  async create(data: CreatePortfolioDto, _user: IUserWithPermissions) {
    if (
      data.name.trim().toLowerCase() === INTERNAL_PORTFOLIO_NAME.toLowerCase()
    ) {
      throw new ConflictException(
        `"${INTERNAL_PORTFOLIO_NAME}" is reserved by the system`
      )
    }
    const existing = await this.portfolioRepository.findByName(data.name)
    if (existing)
      throw new ConflictException('Portfolio with this name already exists')
    const portfolio = await this.portfolioRepository.create(data)
    await this.globalFilterCache.invalidateAll()
    return portfolio
  }

  async findAll(
    query: PortfolioQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PortfolioWithCounts>> {
    this.logger.log(`portfolio:findAll — fetching from MongoDB (no cache)`)

    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      const usePagination = query.page != null && query.limit != null
      return {
        data: [],
        metadata: {
          totalDocuments: 0,
          currentPage: usePagination ? query.page || 1 : 1,
          totalPages: 0,
          limit: usePagination ? query.limit || 10 : 0
        }
      }
    }

    const additionalFilters: any = {}
    if (query.service_type_id)
      additionalFilters.service_type_id = query.service_type_id
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
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    const queryConfig = {
      searchFields: ['name'],
      filterableFields: ['service_type_id', 'is_active'],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'is_commissionable'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {}
    }

    const baseWhere =
      accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }

    const { where, skip, take, orderBy, usePagination } =
      QueryBuilder.buildPrismaQuery(mergedQuery, queryConfig, baseWhere)

    const [data, total] = await Promise.all([
      this.portfolioRepository.findAll({ where, skip, take, orderBy }),
      this.portfolioRepository.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? query.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

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

  async findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PortfolioWithCounts> {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const cacheKey = CACHE_KEY(id)
    const cached = await this.redisService.get<PortfolioWithCounts>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] portfolio:findOne — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] portfolio:findOne — fetching from MongoDB (key: ${cacheKey})`
    )

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    await this.redisService.set(cacheKey, portfolio, CACHE_TTL_ITEM)
    return portfolio
  }

  async getContractUrls(id: string, user: IUserWithPermissions) {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    return this.portfolioRepository.findContractUrls(id)
  }

  async getContact(
    id: string,
    user: IUserWithPermissions
  ): Promise<PortfolioContact> {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    return {
      contact_email: portfolio.contact_email,
      portfolio_contact_email: portfolio.portfolio_contact_email,
      portfolio_contact_name: portfolio.portfolio_contact_name,
      portfolio_contact_phone: portfolio.portfolio_contact_phone
    }
  }

  async getContactExternal(id: string): Promise<PortfolioContact> {
    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    return {
      contact_email: portfolio.contact_email,
      portfolio_contact_email: portfolio.portfolio_contact_email,
      portfolio_contact_name: portfolio.portfolio_contact_name,
      portfolio_contact_phone: portfolio.portfolio_contact_phone
    }
  }

  async getContractUrlsExternal(id: string) {
    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    return this.portfolioRepository.findContractUrls(id)
  }

  async uploadContractUrls(
    id: string,
    files: Express.Multer.File[],
    dto: UploadAndCreateFileDto,
    user: IUserWithPermissions
  ) {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    const result = await this.fileUploadService.createBulkFiles(
      files,
      { ...dto, portfolio_id: id },
      user
    )

    if (result.created.length > 0) {
      await this.syncFileCount(id, result.created.length)
    }

    return result
  }

  private async syncFileCount(
    portfolioId: string,
    count: number,
    type: 'increment' | 'decrement' = 'increment'
  ): Promise<void> {
    if (!this.dashboardClient) {
      this.logger.warn('[sync] dashboard disabled, skipping file count sync')
      return
    }
    await this.postSync(
      this.dashboardClient,
      `/api/portfolio/sync-file-count/${portfolioId}`,
      { type, count },
      'dashboard',
      'file-count-sync'
    )
  }

  async deleteContractUrl(
    id: string,
    fileId: string,
    user: IUserWithPermissions
  ): Promise<{ message: string }> {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    const file = await this.fileUploadService.findOneFile(fileId, user)
    if (file.portfolio_id !== id)
      throw new NotFoundException('Contract URL not found')

    const result = await this.fileUploadService.removeFile(fileId, user)
    await this.syncFileCount(id, 1, 'decrement')
    return result
  }

  async bulkDeleteContractUrls(
    id: string,
    fileIds: string[],
    user: IUserWithPermissions
  ): Promise<{
    deleted: string[]
    failed: Array<{ fileId: string; reason: string }>
  }> {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Portfolio not found')
    }

    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    const deleted: string[] = []
    const failed: Array<{ fileId: string; reason: string }> = []

    for (const fileId of fileIds) {
      try {
        const file = await this.fileUploadService.findOneFile(fileId, user)
        if (file.portfolio_id !== id) {
          failed.push({
            fileId,
            reason: 'Contract URL not found in this portfolio'
          })
          continue
        }
        await this.fileUploadService.removeFile(fileId, user)
        deleted.push(fileId)
      } catch (e: any) {
        failed.push({ fileId, reason: e?.message ?? String(e) })
      }
    }

    if (deleted.length > 0) {
      await this.syncFileCount(id, deleted.length, 'decrement')
    }

    return { deleted, failed }
  }

  async update(
    id: string,
    data: UpdatePortfolioDto,
    user: IUserWithPermissions
  ) {
    const existing = await this.findOne(id, user)
    if (!existing) {
      throw new NotFoundException('Portfolio not found')
    }
    if (existing.name === INTERNAL_PORTFOLIO_NAME) {
      throw new BadRequestException(
        `"${INTERNAL_PORTFOLIO_NAME}" cannot be updated`
      )
    }
    if (
      data.name?.trim().toLowerCase() === INTERNAL_PORTFOLIO_NAME.toLowerCase()
    ) {
      throw new ConflictException(
        `"${INTERNAL_PORTFOLIO_NAME}" is reserved by the system`
      )
    }
    const updated = await this.portfolioRepository.update(id, data)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.globalFilterCache.invalidateAll()
    ])
    return updated
  }

  async updateAndSync(
    id: string,
    data: UpdatePortfolioDto,
    user: IUserWithPermissions
  ) {
    const before = await this.findOne(id, user)
    const beforeAttachmentCount = this.getAttachmentCount(before)
    const updated = await this.update(id, data, user)
    const full = await this.portfolioRepository.findById(updated.id)
    try {
      if (full) {
        const attachmentDelta =
          this.getAttachmentCount(full) - beforeAttachmentCount

        if (attachmentDelta > 0) {
          await this.syncFileCount(id, attachmentDelta, 'increment')
        } else if (attachmentDelta < 0) {
          await this.syncFileCount(id, Math.abs(attachmentDelta), 'decrement')
        }

        if (!this.isAttachmentsOnlyUpdate(data)) {
          await this.fanOutPortfolioUpdate(full, before.name)
          void this.syncActionLogWriter.writeSingle({
            entity_type: 'PORTFOLIO',
            action: 'UPDATE',
            entity_id: full.id,
            entity_name: full.name,
            success: true,
            dbms: 'updated',
            ...this.syncActionLogWriter.actorFromUser(user)
          })
        }
      }
    } catch (e: any) {
      this.logger.error(
        `[sync] unexpected on portfolio update: ${e?.message ?? e}`
      )
    }
    return full ?? updated
  }

  private getAttachmentCount(portfolio: {
    attachments?: string[]
    attachment?: string | null
  }): number {
    if (portfolio.attachments?.length) {
      return portfolio.attachments.length
    }
    if (portfolio.attachment?.trim()) {
      return 1
    }
    return 0
  }

  private isAttachmentsOnlyUpdate(data: UpdatePortfolioDto): boolean {
    const keys = Object.keys(data).filter(
      key => (data as Record<string, unknown>)[key] !== undefined
    )
    if (!keys.length) return false
    return keys.every(key => key === 'attachments' || key === 'attachment')
  }

  private async fanOutPortfolioUpdate(
    portfolio: PortfolioWithCounts,
    oldName: string
  ) {
    const dashboardPayload = {
      _id: portfolio.id,
      oldName,
      name: portfolio.name,
      ...(portfolio.service_type?.type
        ? { service_type: portfolio.service_type.type }
        : {}),
      is_active: portfolio.is_active,
      is_commissionable: portfolio.is_commissionable,
      ...(portfolio.contact_email !== undefined &&
      portfolio.contact_email !== null
        ? { contact_email: portfolio.contact_email }
        : {})
    }

    const jobs: Array<Promise<void>> = []

    this.queueUpsertSync(jobs, portfolio, 'update')

    if (this.dashboardClient) {
      jobs.push(
        this.postSync(
          this.dashboardClient,
          '/api/portfolio/sync-update',
          dashboardPayload,
          'dashboard',
          'update'
        )
      )
    } else {
      this.logger.warn(
        '[sync] dashboard disabled, skipping portfolio update sync'
      )
    }

    const results = await Promise.allSettled(jobs)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `[sync] portfolio update fan-out failed: ${result.reason}`
        )
      }
    }
  }

  async remove(id: string, user: IUserWithPermissions) {
    const portfolio = await this.findOne(id, user)
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found')
    }
    if (portfolio.name === INTERNAL_PORTFOLIO_NAME) {
      throw new BadRequestException(
        `"${INTERNAL_PORTFOLIO_NAME}" cannot be deleted`
      )
    }
    const internalPortfolio = await this.ensureInternalPortfolio()
    const movedProperties =
      await this.portfolioRepository.reassignPropertiesToPortfolio(
        id,
        internalPortfolio.id
      )
    await this.portfolioRepository.delete(id)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.globalFilterCache.invalidateAllIncludingPropertyItems()
    ])
    try {
      if (this.dashboardClient) {
        await this.postSync(
          this.dashboardClient,
          `/api/portfolio/sync-delete/${id}`,
          {},
          'dashboard',
          'sync-delete'
        )
      } else {
        this.logger.warn(
          '[sync] dashboard disabled, skipping portfolio sync-delete'
        )
      }
    } catch (e: any) {
      this.logger.error(
        `[sync] unexpected on portfolio sync-delete: ${e?.message ?? e}`
      )
    }
    return {
      message: `Portfolio deleted successfully. ${movedProperties} properties were moved to "${INTERNAL_PORTFOLIO_NAME}".`
    }
  }

  async removeAndSync(id: string, user: IUserWithPermissions) {
    const before = await this.findOne(id, user)
    const result = await this.remove(id, user)
    try {
      await this.fanOutPortfolioDelete(before.id, before.name)
    } catch (e: any) {
      this.logger.error(
        `[sync] unexpected on portfolio delete: ${e?.message ?? e}`
      )
    }
    void this.syncActionLogWriter.writeSingle({
      entity_type: 'PORTFOLIO',
      action: 'DELETE',
      entity_id: before.id,
      entity_name: before.name,
      success: true,
      dbms: 'deleted',
      ...this.syncActionLogWriter.actorFromUser(user)
    })
    return result
  }

  private async fanOutPortfolioDelete(id: string, name: string) {
    const payload = { _id: id, name }
    const jobs: Array<Promise<void>> = []

    if (this.scraperClient) {
      jobs.push(
        this.postSync(
          this.scraperClient,
          `/portfolios/sync-delete/${id}`,
          {},
          'scraper',
          'delete'
        )
      )
    } else {
      this.logger.warn(
        '[sync] scraper disabled, skipping portfolio delete sync'
      )
    }

    if (this.dashboardClient) {
      jobs.push(
        this.postSync(
          this.dashboardClient,
          '/api/portfolio/sync-delete',
          payload,
          'dashboard',
          'delete'
        )
      )
    } else {
      this.logger.warn(
        '[sync] dashboard disabled, skipping portfolio delete sync'
      )
    }

    const results = await Promise.allSettled(jobs)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `[sync] portfolio delete fan-out failed: ${result.reason}`
        )
      }
    }
  }

  async importFromExcel(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPortfoliosResult> {
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
    if (
      !headers.some(
        h =>
          h.toLowerCase().includes('portfolio') &&
          h.toLowerCase().includes('name')
      )
    ) {
      const hasName = headers.some(
        h => h.toLowerCase() === 'portfolio' || h.toLowerCase() === 'name'
      )
      if (!hasName) {
        throw new BadRequestException(
          'Excel must contain "Portfolio" or "Portfolio Name" column'
        )
      }
    }

    const portfolioCol =
      headers.find(
        h =>
          h.toLowerCase() === 'portfolio name' ||
          h.toLowerCase() === 'portfolio'
      ) || 'Portfolio'

    const serviceTypeCol =
      headers.find(
        h =>
          h.toLowerCase().includes('service') &&
          h.toLowerCase().includes('type')
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
    const portfolios: Array<{
      row_no: number
      portfolio: any
      service_type_name: string
      currency_code: string
      file_count: number
    }> = []
    const skipped_portfolios: any[] = []
    const portfolioNames = [
      ...new Set(
        data
          .map(row => {
            const val = (row as any)[portfolioCol]
            return val && String(val).trim() ? String(val).trim() : null
          })
          .filter(Boolean)
      )
    ] as string[]

    this.logger.log(
      `Processing ${portfolioNames.length} unique portfolios from ${data.length} rows`
    )

    for (const name of portfolioNames) {
      const rowIndex = data.findIndex(
        r => String((r as any)[portfolioCol]).trim() === name
      )
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
        let resolved_service_type_name: string = defaultServiceType.type

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
          resolved_service_type_name = st.type
        }

        const valActive = row?.['Active status']
        const is_active =
          valActive !== undefined
            ? ['active', 'yes', 'true', '1'].includes(
                String(valActive).toLowerCase().trim()
              )
            : true

        const valCommissionable = row?.['Commissionable']
        const is_commissionable =
          valCommissionable !== undefined
            ? ['yes', 'true', '1'].includes(
                String(valCommissionable).toLowerCase().trim()
              )
            : false

        const valContractSigned = row?.['Contract Signed']
        const contract_signed =
          valContractSigned !== undefined
            ? ['yes', 'true', '1'].includes(
                String(valContractSigned).toLowerCase().trim()
              )
            : undefined

        const dto: CreatePortfolioDto = {
          name,
          service_type_id,
          is_active,
          is_commissionable,
          contact_email: row?.['Contact Email']
            ? String(row['Contact Email']).trim()
            : undefined,
          portfolio_contact_email: row?.['Portfolio Contact Email']
            ? String(row['Portfolio Contact Email']).trim()
            : undefined,
          portfolio_contact_name: row?.['Portfolio Contact Name']
            ? String(row['Portfolio Contact Name']).trim()
            : undefined,
          portfolio_contact_phone: row?.['Portfolio Contact Phone']
            ? String(row['Portfolio Contact Phone']).trim()
            : undefined,
          commission:
            row?.['Commission'] != null ? Number(row['Commission']) : undefined,
          attachments: row?.['Attachments']
            ? String(row['Attachments'])
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
          contract_signed
        }

        const resolved_currency_code: string = row?.['Currency']
          ? String(row['Currency']).trim().toUpperCase()
          : ''

        const created = await this.portfolioRepository.create(dto)

        // Create File records for each URL in the Documents column → becomes contract_urls
        let file_count = 0
        if (row?.['Documents']) {
          const urls = String(row['Documents'])
            .split(',')
            .map((u: string) => u.trim())
            .filter(Boolean)
          for (const url of urls) {
            const fileName = url.split('/').pop() ?? 'contract-document'
            try {
              await this.prisma.file.create({
                data: {
                  url,
                  name: fileName,
                  is_active: true,
                  uploaded_by: user.id,
                  portfolio_id: created.id
                }
              })
              file_count++
            } catch (fileErr: any) {
              this.logger.warn(
                `[import] Could not create File record for URL "${url}" on portfolio "${name}": ${fileErr?.message ?? fileErr}`
              )
            }
          }
        }
        portfolios.push({
          row_no,
          portfolio: created,
          service_type_name: resolved_service_type_name,
          currency_code: resolved_currency_code,
          file_count
        })
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

    await this.globalFilterCache.invalidateAll()

    // ── Dashboard & scraper sync — one portfolio at a time ─────────────────
    // Uses the long upload-job timeout (not the 15s SYNC_TIMEOUT_MS env
    // default) since this loop can run for a while over many portfolios.
    for (const { portfolio: p } of portfolios) {
      await this.syncUpsertPortfolioToScraperAndDashboard(
        p.id,
        UPLOAD_JOB_HTTP_TIMEOUT_MS
      ).catch(e =>
        this.logger.error(
          `[sync] portfolio upsert after bulk import failed for "${p.name}": ${e?.message ?? e}`
        )
      )
    }

    const importItems = [
      ...portfolios.map(({ portfolio: p, row_no }) => ({
        id: p.id,
        name: p.name,
        success: true,
        dbms: 'created',
        reason: undefined as string | undefined
      })),
      ...skipped_portfolios.map(s => ({
        id: undefined as string | undefined,
        name: s.portfolio_name,
        success: false,
        dbms: 'skipped',
        reason: s.reason
      }))
    ]

    if (importItems.length > 0) {
      void this.syncActionLogWriter.write({
        scope: 'BULK',
        entity_type: 'PORTFOLIO',
        action: 'IMPORT',
        items: importItems,
        total_count: importItems.length,
        success_count: portfolios.length,
        failed_count: skipped_portfolios.length,
        ...this.syncActionLogWriter.actorFromUser(user)
      })
    }

    return {
      portfoliosCreated,
      portfolios: portfolios.map(({ portfolio: p }) => p),
      skipped_portfolios
    }
  }

  async findAllCached(
    user: IUserWithPermissions
  ): Promise<PortfolioWithCounts[]> {
    const cacheKey = `portfolio:all:${user.id}`
    const cached = await this.redisService.get<PortfolioWithCounts[]>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] portfolio:findAllCached — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] portfolio:findAllCached — fetching from MongoDB (key: ${cacheKey})`
    )

    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    const where = accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    const data = await this.portfolioRepository.findAll({
      where,
      orderBy: { created_at: 'desc' }
    })

    // TTL 0 = no expiry; invalidated explicitly on every write operation
    await this.redisService.set(cacheKey, data, 0)
    return data
  }

  private hashQuery(query: object): string {
    return createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16)
  }

  private async fanOutPortfolioCreate(portfolio: PortfolioWithCounts) {
    const dashboardPayload = {
      _id: portfolio.id,
      name: portfolio.name,
      ...(portfolio.service_type?.type
        ? { service_type: portfolio.service_type.type }
        : {}),
      is_active: portfolio.is_active,
      is_commissionable: portfolio.is_commissionable,
      ...(portfolio.contact_email
        ? { contact_email: portfolio.contact_email }
        : {})
    }

    const jobs: Array<Promise<void>> = []

    this.queueUpsertSync(jobs, portfolio, 'create')

    if (this.dashboardClient) {
      jobs.push(
        this.postSync(
          this.dashboardClient,
          '/api/portfolio/sync-create',
          dashboardPayload,
          'dashboard'
        )
      )
    } else {
      this.logger.warn(
        '[sync] dashboard disabled, skipping portfolio create sync'
      )
    }

    const results = await Promise.allSettled(jobs)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error(
          `[sync] portfolio create fan-out failed: ${result.reason}`
        )
      }
    }
  }

  private queueUpsertSync(
    jobs: Array<Promise<void>>,
    portfolio: PortfolioWithCounts,
    operation: 'create' | 'update'
  ) {
    const scraperUpsertBody = { name: portfolio.name }

    if (this.scraperClient) {
      jobs.push(
        this.postSync(
          this.scraperClient,
          `/portfolios/sync-upsert/${portfolio.id}`,
          scraperUpsertBody,
          'scraper',
          `upsert-${operation}`
        )
      )
    } else {
      this.logger.warn(
        `[sync] scraper disabled, skipping portfolio upsert ${operation} sync`
      )
    }

    if (!this.dashboardClient) {
      this.logger.warn(
        `[sync] dashboard disabled, skipping portfolio upsert ${operation} sync`
      )
      return
    }
    jobs.push(
      this.postSync(
        this.dashboardClient,
        `/api/portfolio/sync-upsert/${portfolio.id}`,
        {
          name: portfolio.name,
          service_type: portfolio.service_type?.type ?? '',
          currency: portfolio.currency?.code ?? 'USD',
          is_active: portfolio.is_active,
          is_commissionable: portfolio.is_commissionable
        },
        'dashboard',
        `upsert-${operation}`
      )
    )
  }

  private async postSync(
    client: AxiosInstance,
    path: string,
    body: Record<string, unknown>,
    target: string,
    operation = 'create'
  ): Promise<void> {
    await this.postSyncResult(client, path, body, target, operation)
  }

  /** Same as postSync but returns the outcome instead of only logging it. */
  private async postSyncResult(
    client: AxiosInstance | null,
    path: string,
    body: Record<string, unknown>,
    target: string,
    operation = 'create',
    timeoutMs?: number
  ): Promise<{ success: boolean; reason?: string }> {
    if (!client) {
      const reason = `${target} sync disabled — URL missing or auth not configured`
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }
    try {
      const r = await client.post(
        path,
        body,
        timeoutMs !== undefined ? { timeout: timeoutMs } : undefined
      )
      this.logger.log(
        `[sync] ${target} portfolio ${operation}: ${JSON.stringify(r.data)}`
      )
      return { success: true }
    } catch (e: any) {
      const reason = e?.response?.data
        ? JSON.stringify(e.response.data)
        : (e?.message ?? String(e))
      this.logger.error(`[sync] ${target} portfolio ${operation} failed: ${reason}`)
      return { success: false, reason }
    }
  }

  /**
   * Single-portfolio upsert to scraper + dashboard, used by the property
   * bulk import/update upload-job pipeline (see PropertyService). Unlike
   * fanOutPortfolioCreate/queueUpsertSync this never throws — every target
   * reports its own { success, reason } so the caller can persist granular
   * per-system status for the frontend to poll.
   */
  async syncUpsertPortfolioToScraperAndDashboard(
    portfolioId: string,
    timeoutMs?: number
  ): Promise<{
    scraper: { success: boolean; reason?: string }
    dashboard: { success: boolean; reason?: string }
  }> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        service_type: { select: { type: true } },
        currency: { select: { code: true } }
      }
    })
    if (!portfolio) {
      const reason = `Portfolio ${portfolioId} not found`
      return {
        scraper: { success: false, reason },
        dashboard: { success: false, reason }
      }
    }

    const [scraper, dashboard] = await Promise.all([
      this.postSyncResult(
        this.scraperClient,
        `/portfolios/sync-upsert/${portfolio.id}`,
        { name: portfolio.name },
        'scraper',
        'upsert',
        timeoutMs
      ),
      this.postSyncResult(
        this.dashboardClient,
        `/api/portfolio/sync-upsert/${portfolio.id}`,
        {
          name: portfolio.name,
          service_type: portfolio.service_type?.type ?? '',
          currency: portfolio.currency?.code ?? 'USD',
          is_active: portfolio.is_active,
          is_commissionable: portfolio.is_commissionable
        },
        'dashboard',
        'upsert',
        timeoutMs
      )
    ])

    return { scraper, dashboard }
  }

  async createAndSync(data: CreatePortfolioDto, user: IUserWithPermissions) {
    const portfolio = await this.create(data, user)
    const full = await this.portfolioRepository.findById(portfolio.id)
    try {
      if (full) await this.fanOutPortfolioCreate(full)
    } catch (e: any) {
      this.logger.error(
        `[sync] unexpected on portfolio create: ${e?.message ?? e}`
      )
    }
    const name = full?.name ?? portfolio.name
    const id = full?.id ?? portfolio.id
    void this.syncActionLogWriter.writeSingle({
      entity_type: 'PORTFOLIO',
      action: 'CREATE',
      entity_id: id,
      entity_name: name,
      success: true,
      dbms: 'created',
      ...this.syncActionLogWriter.actorFromUser(user)
    })
    return full ?? portfolio
  }

}
