import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Priority } from '@prisma/client'
import axios, { AxiosInstance } from 'axios'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { RunDateCalculatorService } from '../../common/services/run-date-calculator.service'
import { GlobalFilterCacheService } from '../../common/services/global-filter-cache.service'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import {
  EXCEL_HISTORICAL_DATE_HEADERS,
  findExcelCellValue,
  findExcelDateValue,
  mapPropertyToExcelRow,
  writePropertyExportBuffer
} from '../../common/utils/property-excel.util'
import type { Configuration } from '../../config/configuration'
import type { IAuthRepository } from '../auth/auth.interface'
import type { IPortfolioService } from '../portfolio/portfolio.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsService } from '../property-credentials/property-credentials.interface'
import { RedisService } from '../redis/redis.service'
import type { ISubportfolioService } from '../subportfolio/subportfolio.interface'
import {
  collectPropertyUniqueConflicts,
  normalizePropertyIdentifier,
  propertyIdentifierKey
} from './property-uniqueness.util'
import type {
  SyncBulkDeleteResponseDto,
  SyncBulkUpsertRowResult
} from './property.dto'
import {
  BulkUpdateResultDto,
  CreatePropertyDto,
  ExportPropertyExcelDto,
  GetPropertyCredentialDto,
  PropertyFilterDto,
  RequiredFieldType,
  SyncBulkDeleteBodyDto,
  SyncByOtaDto,
  UpdatePropertyDto
} from './property.dto'
import { applyColumnFilter } from './property-column-filter.util'
import type {
  AllDataForGlobalFilterResponse,
  ImportPropertiesResult,
  ImportPropertyRow,
  IPropertyRepository,
  IPropertyService,
  PropertyContact,
  PropertyWithRelations
} from './property.interface'

const CACHE_TTL_ITEM = 5 * 60 * 1000 // 5 minutes for individual records
const CACHE_TTL_ALL = 60 * 60 * 1000 // 1 hour for all properties cache
const CACHE_KEY = (id: string) => `property:${id}`
const GLOBAL_FILTER_KEY = (userId: string) => `global-filter:all:${userId}`

@Injectable()
export class PropertyService implements IPropertyService {
  private readonly logger = new Logger(PropertyService.name)

  private async invalidateCaches(): Promise<void> {
    await this.globalFilterCache.invalidateAll()
  }

  /** Rebuilds source caches in parallel so the next global-filter request is fast. */
  private scheduleCacheWarm(user: IUserWithPermissions): void {
    void this.warmGlobalFilterCaches(user).catch(err =>
      this.logger.warn(
        `[cache warm] failed for user ${user.id}: ${err?.message ?? err}`
      )
    )
  }

  private async warmGlobalFilterCaches(
    user: IUserWithPermissions
  ): Promise<void> {
    await Promise.all([
      this.portfolioService.findAllCached(user),
      this.findAllCachedForGlobalFilter(user),
      this.subportfolioService.findAllCachedForGlobalFilter(user),
      this.getAllDataForGlobalFilter(user)
    ])
    this.logger.debug(
      `[cache warm] property, portfolio, subportfolio, and global-filter caches rebuilt for user ${user.id}`
    )
  }
  private readonly dashboardClient: AxiosInstance | null
  private readonly dashboardJwtClient: AxiosInstance | null
  private readonly scraperClient: AxiosInstance | null
  private readonly scraperJwtClient: AxiosInstance | null

  constructor(
    @Inject('IPropertyRepository')
    private readonly repo: IPropertyRepository,
    @Inject('IPropertyCredentialsService')
    private readonly credentialsService: IPropertyCredentialsService,
    @Inject('IAuthRepository')
    private readonly authRepository: IAuthRepository,
    @Inject('IPortfolioService')
    private readonly portfolioService: IPortfolioService,
    @Inject('ISubportfolioService')
    private readonly subportfolioService: ISubportfolioService,
    private readonly encryptionUtil: EncryptionUtil,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailUtil: EmailUtil,
    private readonly config: ConfigService<Configuration>,
    private readonly syncCommunication: SyncCommunicationService,
    private readonly runDateCalculator: RunDateCalculatorService,
    private readonly globalFilterCache: GlobalFilterCacheService
  ) {
    const timeout = this.config.get('syncTimeoutMs', { infer: true }) ?? 15000
    const dashUrl =
      this.config.get('dashboardBackendUrl', { infer: true }) ?? ''
    const dashTok =
      this.config.get('dashboardServiceToken', { infer: true }) ?? ''
    const scrUrl = this.config.get('scraperBackendUrl', { infer: true }) ?? ''
    const scrTok = this.config.get('scraperServiceToken', { infer: true }) ?? ''
    this.dashboardClient =
      dashUrl && dashTok
        ? axios.create({
            baseURL: dashUrl,
            timeout,
            headers: { 'X-Service-Token': dashTok }
          })
        : null
    this.dashboardJwtClient =
      dashUrl && this.syncCommunication.isConfigured()
        ? axios.create({ baseURL: dashUrl, timeout })
        : null
    this.scraperClient =
      scrUrl && scrTok
        ? axios.create({
            baseURL: scrUrl,
            timeout,
            headers: { 'X-Service-Token': scrTok }
          })
        : null
    this.scraperJwtClient =
      scrUrl && this.syncCommunication.isConfigured()
        ? axios.create({ baseURL: scrUrl, timeout })
        : null
    if (!this.dashboardClient)
      this.logger.warn('[sync] dashboard disabled — URL/token missing')
    if (!this.dashboardJwtClient)
      this.logger.warn(
        '[sync] dashboard JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      )
    if (!this.scraperClient)
      this.logger.warn('[sync] scraper disabled — URL/token missing')
    if (!this.scraperJwtClient)
      this.logger.warn(
        '[sync] scraper JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      )
  }

  async create(
    data: CreatePropertyDto,
    _user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const normalizedIdentifier = normalizePropertyIdentifier(
      data.property_identifier
    )
    const conflicts = await collectPropertyUniqueConflicts(this.prisma, {
      property_identifier: normalizedIdentifier,
      name: data.name,
      expedia_id: data.expedia_id,
      booking_id: data.booking_id,
      agoda_id: data.agoda_id
    })
    if (conflicts.length) {
      throw new ConflictException(conflicts.join('; '))
    }

    const {
      credentials,
      qp_username,
      qp_password,
      qp_api_key,
      fp_password,
      ...propertyData
    } = data

    const encryptedData: any = { ...propertyData }
    if (data.property_identifier !== undefined) {
      encryptedData.property_identifier = normalizedIdentifier ?? null
    }
    if (qp_username) encryptedData.qp_username = qp_username
    if (qp_password)
      encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key)
      encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
    if (fp_password)
      encryptedData.fp_password = this.encryptionUtil.encrypt(fp_password)
    if (encryptedData.webmail_password)
      encryptedData.webmail_password = this.encryptionUtil.encrypt(
        encryptedData.webmail_password
      )

    const property = await this.repo.create(encryptedData)

    if (credentials && Object.keys(credentials).length > 0) {
      try {
        await this.credentialsService.create({
          ...credentials,
          property_id: property.id
        })
      } catch (error) {
        await this.repo.delete(property.id)
        throw error
      }
    }

    // Auto-calculate run dates respecting per-OTA priority:
    //   REGULAR + _to + CRS → standard formula (capacity-adjusted)
    //   HIGH + _to          → run_date = created_at + 1 day
    //   no priority         → legacy: calculate if _to + _crs present
    const runDateUpdates = await this.runDateCalculator.calcRunDatesForProperty(
      {
        created_at:       property.created_at,
        expedia_to:       encryptedData.expedia_to,
        expedia_crs:      encryptedData.expedia_crs,
        expedia_priority: encryptedData.expedia_priority,
        booking_to:       encryptedData.booking_to,
        booking_crs:      encryptedData.booking_crs,
        booking_priority: encryptedData.booking_priority,
        agoda_to:         encryptedData.agoda_to,
        agoda_crs:        encryptedData.agoda_crs,
        agoda_priority:   encryptedData.agoda_priority
      },
      property.id
    )
    if (Object.keys(runDateUpdates).length > 0) {
      await this.prisma.property.update({
        where: { id: property.id },
        data: runDateUpdates
      })
    }

    await this.invalidateCaches()
    this.scheduleCacheWarm(_user)
    return this.repo.findById(property.id) as Promise<PropertyWithRelations>
  }

  async createAndSync(
    data: CreatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const property = await this.create(data, user)

    const [dashboardResult, parserResult] = await Promise.all([
      this.syncUpsertPropertyToDashboard(property).catch(e => ({
        success: false,
        reason: e?.message ?? String(e)
      })),
      this.syncUpsertPropertyToScraper(property).catch(e => ({
        success: false,
        reason: e?.message ?? String(e)
      }))
    ])

    const identifier =
      property.expedia_id?.toString() ??
      property.booking_id?.toString() ??
      property.agoda_id?.toString() ??
      property.id

    this.emailUtil
      .sendPropertySyncResultEmail(
        user.email,
        { name: property.name, identifier },
        { dbms: true, dashboard: dashboardResult, parser: parserResult },
        'create'
      )
      .catch(e =>
        this.logger.error(
          `[email] sync result email failed: ${e?.message ?? e}`
        )
      )

    return property
  }

  async findAllWithFilters(
    filterDto: PropertyFilterDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<PropertyWithRelations>> {
    this.logger.log(
      `property:findAllWithFilters — fetching from MongoDB (no cache)`
    )

    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      const usePagination = filterDto.page != null && filterDto.limit != null
      return {
        data: [],
        metadata: {
          totalDocuments: 0,
          currentPage: usePagination ? filterDto.page || 1 : 1,
          totalPages: 0,
          limit: usePagination ? filterDto.limit || 10 : 0
        }
      }
    }

    const baseWhere: any =
      accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    const whereConditions: any[] = []
    const orderByArray: any[] = []

    // Pre-process filters to detect date range pairs
    const processedFilters = new Set<string>()
    const filterMap = new Map<string, any>()

    if (filterDto.filters && Array.isArray(filterDto.filters)) {
      // Build a map of all filters for easy lookup
      for (const filter of filterDto.filters) {
        filterMap.set(filter.name, filter)
      }

      for (const filter of filterDto.filters) {
        const { name, sort_by, in: values } = filter

        // Skip if already processed as part of a date range pair
        if (processedFilters.has(name)) continue

        // Collect sort_by for multi-field sorting (independent of filter values)
        if (sort_by) {
          // Handle special cases for relation fields
          if (name === 'property_id') {
            // Map property_id to the actual id field
            orderByArray.push({ id: sort_by })
          } else if (name === 'portfolio_id') {
            // Sort by the actual portfolio_id field, not the relation
            orderByArray.push({ portfolio_id: sort_by })
          } else if (name === 'subportfolio_id') {
            // Sort by the actual subportfolio_id field, not the relation
            orderByArray.push({ subportfolio_id: sort_by })
          } else {
            orderByArray.push({ [name]: sort_by })
          }
        }

        // Skip filter logic if no values provided, but keep sort_by
        if (!values || values.length === 0) continue

        // Handle date range pairs for OTA integrations
        if (name === 'expedia_from') {
          const toFilter = filterMap.get('expedia_to')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            // Both from and to are provided - create range condition
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [
                { expedia_from: { lte: toDate } },
                { expedia_to: { gte: fromDate } }
              ]
            })
            processedFilters.add('expedia_from')
            processedFilters.add('expedia_to')
            continue
          }
        }

        if (name === 'expedia_to') {
          const fromFilter = filterMap.get('expedia_from')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            // Already processed in expedia_from case
            processedFilters.add('expedia_to')
            continue
          }
        }

        if (name === 'booking_from') {
          const toFilter = filterMap.get('booking_to')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            // Both from and to are provided - create range condition
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [
                { booking_from: { lte: toDate } },
                { booking_to: { gte: fromDate } }
              ]
            })
            processedFilters.add('booking_from')
            processedFilters.add('booking_to')
            continue
          }
        }

        if (name === 'booking_to') {
          const fromFilter = filterMap.get('booking_from')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            // Already processed in booking_from case
            processedFilters.add('booking_to')
            continue
          }
        }

        if (name === 'agoda_from') {
          const toFilter = filterMap.get('agoda_to')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            // Both from and to are provided - create range condition
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [
                { agoda_from: { lte: toDate } },
                { agoda_to: { gte: fromDate } }
              ]
            })
            processedFilters.add('agoda_from')
            processedFilters.add('agoda_to')
            continue
          }
        }

        if (name === 'agoda_to') {
          const fromFilter = filterMap.get('agoda_from')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            // Already processed in agoda_from case
            processedFilters.add('agoda_to')
            continue
          }
        }

        if (name === 'from_db') {
          const toFilter = filterMap.get('to_db')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [{ from_db: { lte: toDate } }, { to_db: { gte: fromDate } }]
            })
            processedFilters.add('from_db')
            processedFilters.add('to_db')
            continue
          }
        }
        if (name === 'to_db') {
          const fromFilter = filterMap.get('from_db')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            processedFilters.add('to_db')
            continue
          }
        }

        if (name === 'expedia_scheduler_review_from') {
          const toFilter = filterMap.get('expedia_scheduler_review_to')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [
                { expedia_scheduler_review_from: { lte: toDate } },
                { expedia_scheduler_review_to: { gte: fromDate } }
              ]
            })
            processedFilters.add('expedia_scheduler_review_from')
            processedFilters.add('expedia_scheduler_review_to')
            continue
          }
        }
        if (name === 'expedia_scheduler_review_to') {
          const fromFilter = filterMap.get('expedia_scheduler_review_from')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            processedFilters.add('expedia_scheduler_review_to')
            continue
          }
        }

        if (name === 'expedia_scheduler_review_db_from') {
          const toFilter = filterMap.get('expedia_scheduler_review_db_to')
          if (toFilter && toFilter.in && toFilter.in.length > 0) {
            const fromDate = String(values[0])
            const toDate = String(toFilter.in[0])
            whereConditions.push({
              AND: [
                { expedia_scheduler_review_db_from: { lte: toDate } },
                { expedia_scheduler_review_db_to: { gte: fromDate } }
              ]
            })
            processedFilters.add('expedia_scheduler_review_db_from')
            processedFilters.add('expedia_scheduler_review_db_to')
            continue
          }
        }
        if (name === 'expedia_scheduler_review_db_to') {
          const fromFilter = filterMap.get('expedia_scheduler_review_db_from')
          if (fromFilter && fromFilter.in && fromFilter.in.length > 0) {
            processedFilters.add('expedia_scheduler_review_db_to')
            continue
          }
        }

        switch (name) {
          case 'portfolio_id':
            whereConditions.push({
              OR: [
                { portfolio_id: { in: values } },
                { subportfolio: { portfolio_id: { in: values } } }
              ]
            })
            break
          case 'property_id':
            whereConditions.push({ id: { in: values } })
            break
          case 'subportfolio_id':
            whereConditions.push({ subportfolio_id: { in: values } })
            break
          case 'expedia_id': {
            // Convert to numbers as expedia_id is Int in Prisma schema
            const numericValues = values
              .map(v => {
                const num = Number(v)
                return isNaN(num) ? null : num
              })
              .filter(v => v !== null)
            if (numericValues.length > 0) {
              whereConditions.push({ expedia_id: { in: numericValues } })
            }
            break
          }
          case 'booking_id': {
            // Convert to numbers as booking_id is Int in Prisma schema
            const numericValues = values
              .map(v => {
                const num = Number(v)
                return isNaN(num) ? null : num
              })
              .filter(v => v !== null)
            if (numericValues.length > 0) {
              whereConditions.push({ booking_id: { in: numericValues } })
            }
            break
          }
          case 'agoda_id': {
            // Convert to numbers as agoda_id is Int in Prisma schema
            const numericValues = values
              .map(v => {
                const num = Number(v)
                return isNaN(num) ? null : num
              })
              .filter(v => v !== null)
            if (numericValues.length > 0) {
              whereConditions.push({ agoda_id: { in: numericValues } })
            }
            break
          }
          case 'card_descriptor':
            whereConditions.push({ card_descriptor: { in: values } })
            break
          case 'hotel_address':
            whereConditions.push({ hotel_address: { in: values } })
            break
          case 'new_domain_email':
            whereConditions.push({ new_domain_email: { in: values } })
            break
          case 'portfolio_contact_email':
            whereConditions.push({ portfolio_contact_email: { in: values } })
            break
          case 'primary_case_email':
            whereConditions.push({ primary_case_email: { in: values } })
            break
          case 'expedia_status':
            whereConditions.push({ expedia_status: { in: values } })
            break
          case 'booking_status':
            whereConditions.push({ booking_status: { in: values } })
            break
          case 'agoda_status':
            whereConditions.push({ agoda_status: { in: values } })
            break
          case 'case_management_contact':
            whereConditions.push({ case_management_contact: { in: values } })
            break
          case 'access_contact':
            whereConditions.push({ access_contact: { in: values } })
            break
          case 'reporting_contact':
            whereConditions.push({ reporting_contact: { in: values } })
            break
          case 'expedia_processor_id':
            whereConditions.push({ expedia_processor_id: { in: values } })
            break
          case 'booking_processor_id':
            whereConditions.push({ booking_processor_id: { in: values } })
            break
          case 'agoda_processor_id':
            whereConditions.push({ agoda_processor_id: { in: values } })
            break
          case 'from':
            whereConditions.push({ from: { in: values } })
            break
          case 'to':
            whereConditions.push({ to: { in: values } })
            break
          case 'fp_mid':
            whereConditions.push({ fp_mid: { in: values } })
            break
          case 'stripe_account_email':
            whereConditions.push({ stripe_account_email: { in: values } })
            break
          case 'service_type_id':
            whereConditions.push({ service_type_id: { in: values } })
            break
          case 'currency_id':
            whereConditions.push({ currency_id: { in: values } })
            break
          case 'property_identifier':
            whereConditions.push({ property_identifier: { in: values } })
            break
          case 'portfolio_contact':
            whereConditions.push({ portfolio_contact: { in: values } })
            break
          case 'fp_username':
            whereConditions.push({ fp_username: { in: values } })
            break
          case 'expedia_billing_type_id':
            whereConditions.push({ expedia_billing_type_id: { in: values } })
            break
          case 'expedia_service_type_id':
            whereConditions.push({ expedia_service_type_id: { in: values } })
            break
          case 'expedia_frequency_id':
            whereConditions.push({ expedia_frequency_id: { in: values } })
            break
          case 'expedia_access_level': {
            const condition = this.booleanFilterCondition(
              'expedia_access_level',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_scheduler': {
            const condition = this.booleanFilterCondition(
              'expedia_scheduler',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_duration': {
            const nums = this.intValuesForInClause(values)
            if (nums.length)
              whereConditions.push({ expedia_duration: { in: nums } })
            break
          }
          case 'booking_billing_type_id':
            whereConditions.push({ booking_billing_type_id: { in: values } })
            break
          case 'booking_service_type_id':
            whereConditions.push({ booking_service_type_id: { in: values } })
            break
          case 'booking_frequency_id':
            whereConditions.push({ booking_frequency_id: { in: values } })
            break
          case 'booking_access_level': {
            const condition = this.booleanFilterCondition(
              'booking_access_level',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'booking_scheduler': {
            const condition = this.booleanFilterCondition(
              'booking_scheduler',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'booking_duration': {
            const nums = this.intValuesForInClause(values)
            if (nums.length)
              whereConditions.push({ booking_duration: { in: nums } })
            break
          }
          case 'agoda_billing_type_id':
            whereConditions.push({ agoda_billing_type_id: { in: values } })
            break
          case 'agoda_service_type_id':
            whereConditions.push({ agoda_service_type_id: { in: values } })
            break
          case 'agoda_frequency_id':
            whereConditions.push({ agoda_frequency_id: { in: values } })
            break
          case 'agoda_access_level': {
            const condition = this.booleanFilterCondition(
              'agoda_access_level',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_scheduler': {
            const condition = this.booleanFilterCondition(
              'agoda_scheduler',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_duration': {
            const nums = this.intValuesForInClause(values)
            if (nums.length)
              whereConditions.push({ agoda_duration: { in: nums } })
            break
          }
          case 'need_another_domain': {
            const condition = this.booleanFilterCondition(
              'need_another_domain',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_service_fee':
            whereConditions.push({ expedia_service_fee: { in: values } })
            break
          case 'priority_id':
            whereConditions.push({ priority_id: { in: values } })
            break
          case 'expedia_priority': {
            const condition = this.otaPriorityFilterCondition(
              'expedia_priority',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'booking_priority': {
            const condition = this.otaPriorityFilterCondition(
              'booking_priority',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_priority': {
            const condition = this.otaPriorityFilterCondition(
              'agoda_priority',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_crs':
            whereConditions.push({ expedia_crs: { in: values } })
            break
          case 'expedia_crs_db':
            whereConditions.push({ expedia_crs_db: { in: values } })
            break
          case 'expedia_db_duration': {
            const nums = this.intValuesForInClause(values)
            if (nums.length)
              whereConditions.push({ expedia_db_duration: { in: nums } })
            break
          }
          case 'expedia_credential_verified': {
            const condition = this.booleanFilterCondition(
              'expedia_credential_verified',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_otp_number':
            whereConditions.push({ expedia_otp_number: { in: values } })
            break
          case 'booking_service_fee':
            whereConditions.push({ booking_service_fee: { in: values } })
            break
          case 'booking_credential_verified': {
            const condition = this.booleanFilterCondition(
              'booking_credential_verified',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_service_fee':
            whereConditions.push({ agoda_service_fee: { in: values } })
            break
          case 'agoda_credential_verified': {
            const condition = this.booleanFilterCondition(
              'agoda_credential_verified',
              values
            )
            if (condition) whereConditions.push(condition)
            break
          }
          case 'sales_rep':
            whereConditions.push({ sales_rep: { in: values } })
            break
          case 'expedia_revised_date':
            whereConditions.push({ expedia_revised_date: { in: values } })
            break
          case 'booking_revised_date':
            whereConditions.push({ booking_revised_date: { in: values } })
            break
          case 'agoda_revised_date':
            whereConditions.push({ agoda_revised_date: { in: values } })
            break
          case 'expedia_scheduler_review_from':
            whereConditions.push({ expedia_scheduler_review_from: { in: values } })
            break
          case 'expedia_scheduler_review_to':
            whereConditions.push({ expedia_scheduler_review_to: { in: values } })
            break
          case 'expedia_scheduler_review_db_from':
            whereConditions.push({ expedia_scheduler_review_db_from: { in: values } })
            break
          case 'expedia_scheduler_review_db_to':
            whereConditions.push({ expedia_scheduler_review_db_to: { in: values } })
            break
          case 'expedia_run_date': {
            const dates = this.stringValuesForInClause(values)
            if (dates.length)
              whereConditions.push({ expedia_run_date: { in: dates } })
            break
          }
          case 'expedia_run_date_db': {
            const dates = this.stringValuesForInClause(values)
            if (dates.length)
              whereConditions.push({ expedia_run_date_db: { in: dates } })
            break
          }
          case 'booking_run_date': {
            const dates = this.stringValuesForInClause(values)
            if (dates.length)
              whereConditions.push({ booking_run_date: { in: dates } })
            break
          }
          case 'agoda_run_date': {
            const dates = this.stringValuesForInClause(values)
            if (dates.length)
              whereConditions.push({ agoda_run_date: { in: dates } })
            break
          }
          case 'qp_username':
            whereConditions.push({ qp_username: { in: values } })
            break
          case 'cybersource_mid':
            whereConditions.push({ cybersource_mid: { in: values } })
            break
          case 'adyen_location':
            whereConditions.push({ adyen_location: { in: values } })
            break
          case 'stripe_connected_email':
            whereConditions.push({ stripe_connected_email: { in: values } })
            break
          case 'discontinued_email_ids':
            whereConditions.push({ discontinued_email_ids: { hasSome: values } })
            break
          case 'user_name_expedia':
            whereConditions.push({ credentials: { some: { expediaUsername: { in: values } } } })
            break
          case 'user_name_booking':
            whereConditions.push({ credentials: { some: { bookingUsername: { in: values } } } })
            break
          case 'user_name_agoda':
            whereConditions.push({ credentials: { some: { agodaUsername: { in: values } } } })
            break
        }
      }
    }

    // Handle is_active as a root-level filter (like masked)
    if (filterDto.is_active !== undefined) {
      whereConditions.push({ is_active: filterDto.is_active })
    }

    // Use multi-field sorting if provided, otherwise default to created_at desc
    const orderBy =
      orderByArray.length > 0 ? orderByArray : { created_at: 'desc' }

    // Date range filters for created_at
    if (filterDto.start_date || filterDto.end_date) {
      const dateFilter: any = {}
      if (filterDto.start_date) {
        dateFilter.gte = filterDto.start_date
      }
      if (filterDto.end_date) {
        dateFilter.lte = filterDto.end_date
      }
      whereConditions.push({ created_at: dateFilter })
    }

    if (filterDto.search) {
      whereConditions.push({
        OR: [
          { name: { contains: filterDto.search, mode: 'insensitive' } },
          { description: { contains: filterDto.search, mode: 'insensitive' } },
          {
            hotel_address: { contains: filterDto.search, mode: 'insensitive' }
          },
          {
            property_identifier: {
              contains: filterDto.search,
              mode: 'insensitive'
            }
          },
          {
            portfolio_contact: {
              contains: filterDto.search,
              mode: 'insensitive'
            }
          },
          {
            card_descriptor: {
              contains: filterDto.search,
              mode: 'insensitive'
            }
          },
          {
            portfolio: {
              name: { contains: filterDto.search, mode: 'insensitive' }
            }
          },
          {
            subportfolio: {
              name: { contains: filterDto.search, mode: 'insensitive' }
            }
          }
        ]
      })
    }

    const where =
      whereConditions.length > 0
        ? { AND: [baseWhere, ...whereConditions] }
        : baseWhere

    const usePagination = filterDto.page != null && filterDto.limit != null
    const skip = usePagination
      ? ((filterDto.page || 1) - 1) * (filterDto.limit || 10)
      : undefined
    const take = usePagination ? filterDto.limit || 10 : undefined

    this.logger.debug(`Final where clause: ${JSON.stringify(where, null, 2)}`)

    const [[data, total], columnList] = await Promise.all([
      Promise.all([
        this.repo.findAll({ where, skip, take, orderBy }),
        this.repo.count(where)
      ]),
      this.getRoleColumnList(user)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? filterDto.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

    const applyFilter = (p: PropertyWithRelations) =>
      columnList ? applyColumnFilter(p, columnList) as PropertyWithRelations : p

    const shouldDecrypt = filterDto.masked === false

    if (shouldDecrypt) {
      // Verify credentials when requesting decrypted data
      this.logger.debug('Decryption requested, verifying user credentials')
      const isValidCredentials = await this.verifyUserCredentials(
        filterDto.user_name,
        filterDto.user_password,
        user
      )

      if (!isValidCredentials) {
        // Return masked data with error message
        this.logger.warn(
          `Failed credential verification for user: ${user.email}`
        )
        const dataWithMaskedCredentials = data.map(p =>
          applyFilter(this.maskCredentialsForResponse(p))
        )
        return {
          data: dataWithMaskedCredentials,
          metadata: {
            totalDocuments: total,
            currentPage,
            totalPages,
            limit,
            error: 'Invalid username or password' as string | undefined
          }
        } as PaginatedResult<PropertyWithRelations>
      }

      this.logger.debug(
        'Credentials verified successfully, returning decrypted data'
      )
      const dataWithDecryptedCredentials = data.map(p =>
        applyFilter(this.decryptCredentialsForResponse(p))
      )
      return {
        data: dataWithDecryptedCredentials,
        metadata: {
          totalDocuments: total,
          currentPage,
          totalPages,
          limit
        }
      }
    }

    const dataWithMaskedCredentials = data.map(p =>
      applyFilter(this.maskCredentialsForResponse(p))
    )

    return {
      data: dataWithMaskedCredentials,
      metadata: {
        totalDocuments: total,
        currentPage,
        totalPages,
        limit
      }
    }
  }

  private decryptCredentialsForResponse(
    property: PropertyWithRelations
  ): PropertyWithRelations {
    const result = { ...property } as any
    const prop = property as any
    if (prop.qp_password) {
      try {
        result.qp_password = this.encryptionUtil.decrypt(prop.qp_password)
      } catch {
        result.qp_password = prop.qp_password
      }
    }
    if (prop.qp_api_key) {
      try {
        result.qp_api_key = this.encryptionUtil.decrypt(prop.qp_api_key)
      } catch {
        result.qp_api_key = prop.qp_api_key
      }
    }
    if (prop.webmail_password) {
      try {
        result.webmail_password = this.encryptionUtil.decrypt(
          prop.webmail_password
        )
      } catch {
        result.webmail_password = prop.webmail_password
      }
    }
    if (prop.fp_password) {
      try {
        result.fp_password = this.encryptionUtil.decrypt(prop.fp_password)
      } catch {
        result.fp_password = prop.fp_password
      }
    }
    if (prop.credentials && Array.isArray(prop.credentials)) {
      result.credentials = (prop.credentials as any[]).map((cred: any) => {
        const decrypted: any = { ...cred }
        for (const field of [
          'expediaPassword',
          'agodaPassword',
          'bookingPassword',
          'expediaSecondaryPassword',
          'bookingSecondaryPassword',
          'agodaSecondaryPassword'
        ]) {
          if (cred[field]) {
            try {
              decrypted[field] = this.encryptionUtil.decrypt(cred[field])
            } catch {
              decrypted[field] = cred[field]
            }
          }
        }
        return decrypted
      })
    }
    return result
  }

  /**
   * Returns the column_list from the RoleColumnTemplate for the user's role,
   * or null if no template is defined (meaning return all fields).
   */
  /**
   * Returns the column_list from the ColumnTemplate assigned to the user's role,
   * or null if no template is assigned (meaning all fields are returned).
   */
  private async getRoleColumnList(
    user: IUserWithPermissions
  ): Promise<string[] | null> {
    const role = await this.prisma.userRole.findUnique({
      where: { id: user.user_role_id },
      select: { user_column_template: { select: { column_list: true } } }
    })
    return role?.user_column_template?.column_list ?? null
  }

  private maskCredentialsForResponse(
    property: PropertyWithRelations
  ): PropertyWithRelations {
    const result = { ...property } as any
    const prop = property as any
    const MASK = '********'

    if (prop.qp_password) {
      result.qp_password = MASK
    }
    if (prop.qp_api_key) {
      result.qp_api_key = MASK
    }
    if (prop.webmail_password) {
      result.webmail_password = MASK
    }
    if (prop.fp_password) {
      result.fp_password = MASK
    }
    if (prop.credentials && Array.isArray(prop.credentials)) {
      result.credentials = (prop.credentials as any[]).map((cred: any) => {
        const masked: any = { ...cred }
        if (cred.expediaPassword) masked.expediaPassword = MASK
        if (cred.agodaPassword) masked.agodaPassword = MASK
        if (cred.bookingPassword) masked.bookingPassword = MASK
        if (cred.expediaSecondaryPassword)
          masked.expediaSecondaryPassword = MASK
        if (cred.bookingSecondaryPassword)
          masked.bookingSecondaryPassword = MASK
        if (cred.agodaSecondaryPassword) masked.agodaSecondaryPassword = MASK
        return masked
      })
    }
    return result
  }

  async findOne(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Property not found')
    }

    const cacheKey = CACHE_KEY(id)
    const cached = await this.redisService.get<PropertyWithRelations>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] property:findOne — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] property:findOne — fetching from MongoDB (key: ${cacheKey})`
    )

    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')

    await this.redisService.set(cacheKey, property, CACHE_TTL_ITEM)

    const columnList = await this.getRoleColumnList(user)
    return columnList
      ? applyColumnFilter(property, columnList) as PropertyWithRelations
      : property
  }

  async getContact(
    id: string,
    user: IUserWithPermissions
  ): Promise<PropertyContact> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Property not found')
    }

    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')

    return this.buildPropertyContact(property)
  }

  async getContactExternal(id: string): Promise<PropertyContact> {
    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')

    return this.buildPropertyContact(property)
  }

  private buildPropertyContact(
    property: PropertyWithRelations
  ): PropertyContact {
    const creds = (property as any).credentials
    return {
      // Property-level
      portfolio_contact: property.portfolio_contact ?? null,
      portfolio_contact_email: property.portfolio_contact_email ?? null,
      case_management_contact: property.case_management_contact ?? null,
      access_contact: property.access_contact ?? null,
      reporting_contact: property.reporting_contact ?? null,
      primary_case_email: property.primary_case_email ?? null,
      others_case_emails: property.others_case_emails ?? [],
      new_domain_email: property.new_domain_email ?? null,
      // Credential-level
      property_contact_email: creds?.propertyContactEmail ?? null,
      portfolio_contact_email_cred: creds?.portfolioContactEmail ?? null,
      multiple_portfolio_emails: creds?.multiplePortfolioEmails ?? [],
      case_contact_email: creds?.case_contact_email ?? null,
      case_contact_name: creds?.case_contact_name ?? null,
      case_contact_phone: creds?.case_contact_phone ?? null,
      reporting_contact_name: creds?.reporting_contact_name ?? null,
      reporting_contact_email: creds?.reporting_contact_email ?? null,
      reporting_contact_phone: creds?.reporting_contact_phone ?? null
    }
  }

  async update(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    await this.findOne(id, user)

    const normalizedIdentifier =
      data.property_identifier !== undefined
        ? (normalizePropertyIdentifier(data.property_identifier) ?? null)
        : undefined

    const fieldsToCheck: {
      name?: string | null
      property_identifier?: string | null
      expedia_id?: number | null
      booking_id?: number | null
      agoda_id?: number | null
    } = {}
    if (normalizedIdentifier !== undefined) {
      fieldsToCheck.property_identifier = normalizedIdentifier
    }
    if (data.name !== undefined) fieldsToCheck.name = data.name
    if (data.expedia_id !== undefined)
      fieldsToCheck.expedia_id = data.expedia_id
    if (data.booking_id !== undefined)
      fieldsToCheck.booking_id = data.booking_id
    if (data.agoda_id !== undefined) fieldsToCheck.agoda_id = data.agoda_id

    const conflicts = await collectPropertyUniqueConflicts(
      this.prisma,
      fieldsToCheck,
      id
    )
    if (conflicts.length) {
      throw new ConflictException(conflicts.join('; '))
    }

    const {
      credentials,
      qp_username,
      qp_password,
      qp_api_key,
      fp_password,
      webmail_password,
      ...propertyData
    } = data

    const encryptedData: any = { ...propertyData }
    if (normalizedIdentifier !== undefined) {
      encryptedData.property_identifier = normalizedIdentifier
    }
    if (qp_username !== undefined) encryptedData.qp_username = qp_username
    if (qp_password)
      encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key)
      encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
    if (fp_password)
      encryptedData.fp_password = this.encryptionUtil.encrypt(fp_password)
    if (webmail_password)
      encryptedData.webmail_password =
        this.encryptionUtil.encrypt(webmail_password)

    await this.repo.update(id, encryptedData)

    if (credentials && Object.keys(credentials).length > 0) {
      const existingCredentials =
        await this.credentialsService.findByPropertyId(id)

      if (existingCredentials) {
        await this.credentialsService.update(
          existingCredentials.id,
          credentials
        )
      } else {
        await this.credentialsService.create({
          ...credentials,
          property_id: id
        })
      }
    }

    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.invalidateCaches()
    ])
    this.scheduleCacheWarm(user)
    return this.repo.findById(id) as Promise<PropertyWithRelations>
  }

  async updateAndSync(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ) {
    const existing = await this.repo.findById(id)
    if (!existing) throw new NotFoundException('Property not found')
    const updated = await this.update(id, data, user)

    const [dashboardResult, parserResult] = await Promise.all([
      this.syncUpsertPropertyToDashboard(updated).catch(e => ({
        success: false,
        reason: e?.message ?? String(e)
      })),
      this.syncUpsertPropertyToScraper(updated).catch(e => ({
        success: false,
        reason: e?.message ?? String(e)
      }))
    ])

    const identifier =
      updated.expedia_id?.toString() ??
      updated.booking_id?.toString() ??
      updated.agoda_id?.toString() ??
      updated.id

    this.emailUtil
      .sendPropertySyncResultEmail(
        user.email,
        { name: updated.name, identifier },
        { dbms: true, dashboard: dashboardResult, parser: parserResult },
        'update'
      )
      .catch(e =>
        this.logger.error(
          `[email] sync result email failed: ${e?.message ?? e}`
        )
      )

    return updated
  }

  // ──────────────────────────────────────────────────────────────────────────
  // External bulk delete — called by dashboard via ExternalJwtGuard
  // ──────────────────────────────────────────────────────────────────────────

  async syncBulkDelete(
    body: SyncBulkDeleteBodyDto
  ): Promise<SyncBulkDeleteResponseDto> {
    const { items } = body

    const errors: Array<{ parent_id: string; error: string }> = []
    const successfulDeletes: Array<{ parent_id: string }> = []

    for (const item of items) {
      const { parent_id } = item
      try {
        // 1 ── Verify property exists
        const property = await this.prisma.property.findUnique({
          where: { id: parent_id },
          select: {
            id: true,
            expedia_id: true,
            booking_id: true,
            agoda_id: true
          }
        })
        if (!property) {
          errors.push({
            parent_id,
            error: `Property not found with parent_id: ${parent_id}`
          })
          continue
        }

        // 2 ── Delete from DBMS
        await this.repo.delete(parent_id)
        await Promise.all([
          this.redisService.del(CACHE_KEY(parent_id)),
          this.invalidateCaches()
        ]).catch(() => undefined)

        successfulDeletes.push({ parent_id })
      } catch (err: any) {
        errors.push({ parent_id, error: err?.message ?? String(err) })
        this.logger.error(
          `[sync-bulk-delete] ${parent_id} failed: ${err?.message ?? err}`
        )
      }
    }

    if (successfulDeletes.length) {
      const deletedIds = successfulDeletes.map(({ parent_id }) => parent_id)
      this.syncBulkDeleteToDashboard(deletedIds).catch(e =>
        this.logger.error(
          `[sync] bulk-delete dashboard failed: ${e?.message ?? e}`
        )
      )
      this.syncBulkDeleteToScraper(deletedIds).catch(e =>
        this.logger.error(
          `[sync] bulk-delete scraper failed: ${e?.message ?? e}`
        )
      )
    }

    return {
      totalCount: items.length,
      deletedCount: successfulDeletes.length,
      failureCount: errors.length,
      errors,
      successfulDeletes
    }
  }

  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.invalidateCaches()
    ])
    this.scheduleCacheWarm(user)
    try {
      if (this.dashboardJwtClient) {
        const r = await this.dashboardJwtClient.post(
          `/api/property/sync-delete/${id}`,
          {},
          { headers: this.syncCommunication.createAuthHeaders() }
        )
        this.logger.log(
          `[sync] dashboard property sync-delete: ${JSON.stringify(r.data)}`
        )
      } else {
        this.logger.warn(
          '[sync] dashboard JWT client disabled, skipping property sync-delete'
        )
      }
    } catch (e: any) {
      this.logger.error(
        `[sync] dashboard property sync-delete failed: ${e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? e)}`
      )
    }
    return { message: 'Property deleted successfully' }
  }

  async removeAndSync(id: string, user: IUserWithPermissions) {
    const before = await this.repo.findById(id)
    const result = await this.remove(id, user)
    if (before) {
      try {
        await this.syncDeletePropertyToScraper(before.id)
      } catch (e: any) {
        this.logger.error(`[sync] unexpected on delete: ${e?.message ?? e}`)
      }
    }
    return result
  }

  async transferPortfolio(
    id: string,
    portfolioId: string,
    password: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const userFromDb = await this.authRepository.findUserByEmail(user.email)
    if (!userFromDb) throw new BadRequestException('Invalid credentials')

    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )
    if (!isPasswordValid) throw new BadRequestException('Invalid password')

    const property = await this.findOne(id, user)
    if (property.portfolio_id === portfolioId)
      throw new BadRequestException(
        'Property is already in the specified portfolio'
      )

    await this.repo.update(id, { portfolio_id: portfolioId })
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.invalidateCaches()
    ])
    return this.repo.findById(id) as Promise<PropertyWithRelations>
  }

  async bulkTransferPortfolio(
    ids: string[],
    portfolioId: string,
    password: string,
    user: IUserWithPermissions
  ): Promise<import('./property.interface').BulkTransferResult> {
    const userFromDb = await this.authRepository.findUserByEmail(user.email)
    if (!userFromDb) throw new BadRequestException('Invalid credentials')

    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )
    if (!isPasswordValid) throw new BadRequestException('Invalid password')

    this.logger.log(
      `User ${user.email} attempting bulk transfer of ${ids.length} properties to portfolio ${portfolioId}`
    )

    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)

    const success: Array<{ id: string; name: string }> = []
    const skipped: Array<{ id: string; name?: string; reason: string }> = []

    for (const id of ids) {
      if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
        skipped.push({ id, reason: 'No access to this property' })
        continue
      }

      try {
        const property = await this.repo.findById(id)
        if (!property) {
          skipped.push({ id, reason: 'Property not found' })
          continue
        }
        if (property.portfolio_id === portfolioId) {
          skipped.push({
            id,
            name: property.name,
            reason: 'Property is already in the specified portfolio'
          })
          continue
        }

        await this.repo.update(id, { portfolio_id: portfolioId })
        await this.redisService.del(CACHE_KEY(id))
        success.push({ id: property.id, name: property.name })
      } catch (err: any) {
        this.logger.error(`Error transferring property ${id}: ${err.message}`)
        skipped.push({ id, reason: `Error: ${err.message}` })
      }
    }

    if (success.length > 0) {
      await this.invalidateCaches()
    }

    this.logger.log(
      `Bulk transfer completed: ${success.length} success, ${skipped.length} skipped`
    )

    return {
      success,
      skipped,
      successCount: success.length,
      skippedCount: skipped.length
    }
  }

  async findByPortfolioId(
    portfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const [accessibleIds, columnList] = await Promise.all([
      this.repo.getAccessiblePropertyIds(user.id),
      this.getRoleColumnList(user)
    ])
    const list = await this.repo.findByPortfolioId(portfolioId)
    const filtered = accessibleIds === 'all'
      ? list
      : list.filter(p => (accessibleIds as string[]).includes(p.id))
    return columnList
      ? filtered.map(p => applyColumnFilter(p, columnList) as PropertyWithRelations)
      : filtered
  }

  async findBySubportfolioId(
    subportfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const [accessibleIds, columnList] = await Promise.all([
      this.repo.getAccessiblePropertyIds(user.id),
      this.getRoleColumnList(user)
    ])
    const list = await this.repo.findBySubportfolioId(subportfolioId)
    const filtered = accessibleIds === 'all'
      ? list
      : list.filter(p => (accessibleIds as string[]).includes(p.id))
    return columnList
      ? filtered.map(p => applyColumnFilter(p, columnList) as PropertyWithRelations)
      : filtered
  }

  async getDropdown(user: IUserWithPermissions) {
    return this.repo.getDropdownPortfoliosAndSubportfolios(user.id)
  }

  async getPropertyCredential(
    dto: GetPropertyCredentialDto
  ): Promise<{ credential: Record<string, string> }> {
    const user = await this.authRepository.findUserByEmail(dto.email)
    if (!user) {
      throw new BadRequestException('Invalid credentials')
    }
    if (user.temp_password) {
      throw new BadRequestException('Invalid credentials')
    }
    const isPasswordValid = await EncryptionUtil.comparePassword(
      dto.password,
      user.password
    )
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials')
    }

    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    const hasAccess =
      accessibleIds === 'all' ||
      (Array.isArray(accessibleIds) && accessibleIds.includes(dto.property_id))
    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this property')
    }

    const property = await this.repo.findById(dto.property_id)
    if (!property) {
      throw new NotFoundException('Property not found')
    }

    const result = this.extractAndDecryptCredential(
      property as any,
      dto.required_field
    )
    if (!result) {
      throw new NotFoundException(
        `Credential for "${dto.required_field}" not found for this property`
      )
    }
    return { credential: result }
  }

  private extractAndDecryptCredential(
    property: any,
    requiredField: RequiredFieldType
  ): Record<string, string> | null {
    const safeDecrypt = (val: string | null | undefined): string | null => {
      if (!val) return null
      try {
        return this.encryptionUtil.decrypt(val)
      } catch {
        return val
      }
    }

    switch (requiredField) {
      case 'expedia': {
        const cred = property.credentials?.[0]
        if (!cred?.expediaUsername && !cred?.expediaPassword) return null
        const username = cred.expediaUsername || null
        const password = cred.expediaPassword
          ? safeDecrypt(cred.expediaPassword)
          : null
        if (!username && !password) return null
        return { username: username || '', password: password || '' }
      }
      case 'booking': {
        const cred = property.credentials?.[0]
        if (!cred?.bookingUsername && !cred?.bookingPassword) return null
        const username = cred.bookingUsername || null
        const password = cred.bookingPassword
          ? safeDecrypt(cred.bookingPassword)
          : null
        if (!username && !password) return null
        return { username: username || '', password: password || '' }
      }
      case 'agoda': {
        const cred = property.credentials?.[0]
        if (!cred?.agodaUsername && !cred?.agodaPassword) return null
        const username = cred.agodaUsername || null
        const password = cred.agodaPassword
          ? safeDecrypt(cred.agodaPassword)
          : null
        if (!username && !password) return null
        return { username: username || '', password: password || '' }
      }
      case 'webmail_password': {
        const pwd = property.webmail_password
          ? safeDecrypt(property.webmail_password)
          : null
        if (!pwd) return null
        return { password: pwd }
      }
      case 'qp_api_key': {
        const key = property.qp_api_key
          ? safeDecrypt(property.qp_api_key)
          : null
        if (!key) return null
        return { api_key: key }
      }
      case 'qp_password': {
        const pwd = property.qp_password
          ? safeDecrypt(property.qp_password)
          : null
        if (!pwd) return null
        return { password: pwd }
      }
      default:
        return null
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Export flow — generate Excel from filtered properties and email it
  // ──────────────────────────────────────────────────────────────────────────

  async exportToExcelAndEmail(
    dto: ExportPropertyExcelDto,
    user: IUserWithPermissions
  ): Promise<{ message: string }> {
    // Step 1 — apply filters (masking doesn't matter here; we only need the IDs)
    const filterDto: PropertyFilterDto = {
      ...dto,
      page: undefined,
      limit: undefined
    }
    const filtered = await this.findAllWithFilters(filterDto, user)
    const filteredData = filtered.data as any[]

    if (filteredData.length === 0) {
      return {
        message: 'No properties matched the given filters. Email not sent.'
      }
    }

    // Step 2 — re-fetch the same properties directly from the repo (bypassing the
    // masking layer), then decrypt every credential field explicitly.
    const ids = filteredData.map((p: any) => p.id)
    const raw = await this.repo.findAll({
      where: { id: { in: ids } },
      orderBy: { created_at: 'desc' }
    })
    const properties = raw.map(p => this.decryptCredentialsForResponse(p))

    const rows = properties.map(p => mapPropertyToExcelRow(p))
    const buffer = writePropertyExportBuffer(rows)

    const filename = `properties-export-${new Date().toISOString().slice(0, 10)}.xlsx`

    await this.emailUtil.sendEmail(
      user.email,
      `VNP Solutions – Property Export (${properties.length} records)`,
      `Please find attached the property data export containing ${properties.length} record(s) generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.\n\nWarm regards,\nVNP Solutions`,
      [
        {
          filename,
          content: buffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    )

    return {
      message: `Excel report with ${properties.length} record(s) sent to ${user.email}`
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Import flow  (vnp-parser-backend thin-service convention)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Service responsibilities:
   *  1. Validate the file buffer.
   *  2. Parse the Excel workbook into raw rows.
   *  3. Map every row to a typed ImportPropertyRow, encrypting passwords inline.
   *  4. Delegate ALL DB operations to repo.importProperties().
   */
  async importFromExcel(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPropertiesResult> {
    const buffer = file.buffer || (file as any).buffer
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('File buffer is empty')
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestException('Excel file is empty or invalid')
    }

    // Strip trailing asterisks/spaces from header keys before validation
    // so "Property Name *" is treated the same as "Property Name"
    const headers = Object.keys(rawRows[0]).map(h =>
      h.replace(/\s*\*+\s*$/, '').trim()
    )

    // Required columns
    if (
      !headers.some(
        h =>
          h.toLowerCase() === 'property name' || h.toLowerCase() === 'property'
      )
    ) {
      throw new BadRequestException('Excel must contain "Property Name" column')
    }
    if (!headers.some(h => h.toLowerCase() === 'portfolio')) {
      throw new BadRequestException('Excel must contain "Portfolio" column')
    }
    if (!headers.some(h => h.toLowerCase() === 'property identifier')) {
      throw new BadRequestException(
        'Excel must contain "Property Identifier" column'
      )
    }

    this.logger.log(`Parsing ${rawRows.length} rows for property import`)

    // Map rows to ImportPropertyRow with encryption
    const rows: ImportPropertyRow[] = rawRows
      .map(rawRow => {
        // Strip trailing asterisks (and surrounding spaces) from header keys
        const r: Record<string, any> = {}
        for (const key of Object.keys(rawRow)) {
          r[key.replace(/\s*\*+\s*$/, '').trim()] = rawRow[key]
        }

        const propertyName = r['Property Name']
          ? String(r['Property Name']).trim()
          : ''
        if (!propertyName) return null

        const portfolioName = r['Portfolio']
          ? String(r['Portfolio']).trim()
          : ''
        if (!portfolioName) return null

        // Encrypt passwords
        const encryptPassword = (val: any) => {
          if (!val) return undefined
          const str = String(val).trim()
          return str ? this.encryptionUtil.encrypt(str) : undefined
        }

        const parseBool = (val: any) => {
          if (val === null || val === undefined || val === '') return undefined
          const str = String(val).trim().toLowerCase()
          if (
            str === 'true' ||
            str === '1' ||
            str === 'yes' ||
            str === 'y' ||
            str === 'verified'
          )
            return 'true'
          if (
            str === 'false' ||
            str === '0' ||
            str === 'no' ||
            str === 'n' ||
            str === 'not verified' ||
            str === 'access lost'
          )
            return 'false'
          return undefined
        }

        const parseEnum = (val: any) => {
          if (!val) return undefined
          return String(val).trim().toUpperCase()
        }

        const parseOtaPriority = (names: readonly string[]) => {
          const val = findExcelCellValue(r, names)
          return val ? val.trim().toUpperCase() : undefined
        }

        const dateCol = (names: readonly string[]) =>
          findExcelDateValue(r, names)

        return {
          propertyName,
          portfolioName,
          subportfolioName: findExcelCellValue(r, [
            'Sub Portfolio',
            'Subportfolio',
            'Sub Portfolio Name'
          ]),
          propertyAddress: r['Property Address']
            ? String(r['Property Address']).trim()
            : undefined,
          cardDescriptor: r['Card Descriptor']
            ? String(r['Card Descriptor']).trim()
            : undefined,
          description: r['Description']
            ? String(r['Description']).trim()
            : undefined,
          propertyIdentifier: r['Property Identifier']
            ? String(r['Property Identifier']).trim()
            : undefined,
          portfolioContact: r['Portfolio Contact']
            ? String(r['Portfolio Contact']).trim()
            : undefined,
          expediaId: r['Expedia ID']
            ? String(r['Expedia ID']).trim()
            : undefined,
          agodaId: r['Agoda ID'] ? String(r['Agoda ID']).trim() : undefined,
          bookingId: r['Booking ID']
            ? String(r['Booking ID']).trim()
            : undefined,
          expediaUsername: r['Expedia Username']
            ? String(r['Expedia Username']).trim()
            : undefined,
          agodaUsername: r['Agoda Username']
            ? String(r['Agoda Username']).trim()
            : undefined,
          bookingUsername: r['Booking Username']
            ? String(r['Booking Username']).trim()
            : undefined,
          expediaPassword: encryptPassword(r['Expedia Password']),
          bookingPassword: encryptPassword(r['Booking Password']),
          agodaPassword: encryptPassword(r['Agoda Password']),
          expediaSecondaryUsername: r['Expedia Secondary Username']
            ? String(r['Expedia Secondary Username']).trim()
            : undefined,
          expediaSecondaryPassword: encryptPassword(
            r['Expedia Secondary Password']
          ),
          bookingSecondaryUsername: r['Booking Secondary Username']
            ? String(r['Booking Secondary Username']).trim()
            : undefined,
          bookingSecondaryPassword: encryptPassword(
            r['Booking Secondary Password']
          ),
          agodaSecondaryUsername: r['Agoda Secondary Username']
            ? String(r['Agoda Secondary Username']).trim()
            : undefined,
          agodaSecondaryPassword: encryptPassword(
            r['Agoda Secondary Password']
          ),
          portfolioContactEmail: r['Portfolio Contact Email']
            ? String(r['Portfolio Contact Email']).trim()
            : undefined,
          caseContactEmail: r['Case Contact Email']
            ? String(r['Case Contact Email']).trim()
            : undefined,
          qpUsername: r['Qp Username']
            ? String(r['Qp Username']).trim()
            : undefined,
          qpPassword: encryptPassword(r['Qp Password']),
          qpApiKey: encryptPassword(r['Qp Api Key']),
          fpUsername: r['FP Username']
            ? String(r['FP Username']).trim()
            : undefined,
          fpPassword: encryptPassword(r['FP Password']),
          newDomainsEmail: r['New Domains Email']
            ? String(r['New Domains Email']).trim()
            : undefined,
          webmailPassword: encryptPassword(r['Webmail Password']),
          expediaStatus: r['Expedia Status']
            ? String(r['Expedia Status']).trim()
            : undefined,
          bookingStatus: r['Booking Status']
            ? String(r['Booking Status']).trim()
            : undefined,
          agodaStatus: r['Agoda Status']
            ? String(r['Agoda Status']).trim()
            : undefined,
          caseManagementContact: r['Case Management Contact']
            ? String(r['Case Management Contact']).trim()
            : undefined,
          accessContact: r['Access Contact']
            ? String(r['Access Contact']).trim()
            : undefined,
          reportingContact: r['Reporting Contact']
            ? String(r['Reporting Contact']).trim()
            : undefined,
          expediaProcessor: r['Expedia Processor']
            ? String(r['Expedia Processor']).trim()
            : undefined,
          bookingProcessor: r['Booking Processor']
            ? String(r['Booking Processor']).trim()
            : undefined,
          agodaProcessor: r['Agoda Processor']
            ? String(r['Agoda Processor']).trim()
            : undefined,
          fpMid: r['FP MID'] ? String(r['FP MID']).trim() : undefined,
          stripeAccountEmail: r['Stripe Account Email']
            ? String(r['Stripe Account Email']).trim()
            : undefined,
          expediaBillingType: parseEnum(r['Expedia Billing Type']),
          expediaServiceType: r['Expedia Service Type']
            ? String(r['Expedia Service Type'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          expediaFrequency: r['Expedia Frequency']
            ? String(r['Expedia Frequency'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          expediaAccessLevel: parseBool(r['Expedia Access Level']),
          expediaFrom: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.expediaFrom),
          expediaTo: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.expediaTo),
          expediaScheduler: parseBool(r['Expedia Scheduler']),
          expediaDuration: r['Expedia Duration']
            ? String(r['Expedia Duration']).trim()
            : undefined,
          bookingBillingType: parseEnum(r['Booking Billing Type']),
          bookingServiceType: r['Booking Service Type']
            ? String(r['Booking Service Type'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          bookingFrequency: r['Booking Frequency']
            ? String(r['Booking Frequency'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          bookingAccessLevel: parseBool(r['Booking Access Level']),
          bookingFrom: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.bookingFrom),
          bookingTo: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.bookingTo),
          bookingScheduler: parseBool(r['Booking Scheduler']),
          bookingDuration: r['Booking Duration']
            ? String(r['Booking Duration']).trim()
            : undefined,
          agodaBillingType: parseEnum(r['Agoda Billing Type']),
          agodaServiceType: r['Agoda Service Type']
            ? String(r['Agoda Service Type'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          agodaFrequency: r['Agoda Frequency']
            ? String(r['Agoda Frequency'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          agodaAccessLevel: parseBool(r['Agoda Access Level']),
          agodaFrom: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.agodaFrom),
          agodaTo: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.agodaTo),
          agodaScheduler: parseBool(r['Agoda Scheduler']),
          agodaDuration: r['Agoda Duration']
            ? String(r['Agoda Duration']).trim()
            : undefined,
          needAnotherDomain: parseBool(r['Need Another Domain']),
          bookingOtpPhone: r['Booking OTP Phone']
            ? String(r['Booking OTP Phone']).trim()
            : undefined,
          serviceTypeName: r['Service Type']
            ? String(r['Service Type'])
                .trim()
                .toUpperCase()
                .replace(/[\s\-.]+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/, '')
            : undefined,
          currency: r['Currency'] ? String(r['Currency']).trim() : undefined,
          // New Expedia fields
          expediaServiceFee: r['Expedia Service Fee']
            ? String(r['Expedia Service Fee']).trim()
            : undefined,
          expediaCrs: r['Expedia CRS']
            ? String(r['Expedia CRS']).trim()
            : undefined,
          expediaCrsDb: r['Expedia CRS DB']
            ? String(r['Expedia CRS DB']).trim()
            : undefined,
          expediaRunDateFrom: dateCol([
            'Expedia Run Date From',
            'Expedia Run Date'
          ]),
          expediaRunDateTo: dateCol(['Expedia Run Date To']),
          expediaRunDateDbFrom: dateCol([
            'Expedia Run Date DB From',
            'Expedia Run Date DB'
          ]),
          expediaRunDateDbTo: dateCol(['Expedia Run Date DB To']),
          expediaRevisedDate: dateCol(['Expedia Revised Date']),
          expediaSchedulerReviewFrom: dateCol([
            'Expedia Scheduler Review From'
          ]),
          expediaSchedulerReviewTo: dateCol(['Expedia Scheduler Review To']),
          expediaSchedulerDb: r['Expedia Scheduler DB']
            ? String(r['Expedia Scheduler DB']).trim()
            : undefined,
          expediaSchedulerReviewDbFrom: dateCol([
            'Expedia Scheduler Review DB From'
          ]),
          expediaSchedulerReviewDbTo: dateCol([
            'Expedia Scheduler Review DB To'
          ]),
          expediaDbDuration: r['Expedia DB Duration']
            ? String(r['Expedia DB Duration']).trim()
            : undefined,
          expediaCredentialVerified: parseBool(
            r['Expedia Credential Verified']
          ),
          expediaOtpNumber: r['Expedia OTP Number']
            ? String(r['Expedia OTP Number']).trim()
            : undefined,
          fromDb: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.expediaDbFrom),
          toDb: dateCol(EXCEL_HISTORICAL_DATE_HEADERS.expediaDbTo),
          // New Booking fields
          bookingServiceFee: r['Booking Service Fee']
            ? String(r['Booking Service Fee']).trim()
            : undefined,
          bookingCrs: r['Booking CRS']
            ? String(r['Booking CRS']).trim()
            : undefined,
          bookingRunDateFrom: dateCol([
            'Booking Run Date From',
            'Booking Run Date'
          ]),
          bookingRunDateTo: dateCol(['Booking Run Date To']),
          bookingRevisedDate: dateCol(['Booking Revised Date']),
          bookingCredentialVerified: parseBool(
            r['Booking Credential Verified']
          ),
          bookingOtpNumber: r['Booking OTP Number']
            ? String(r['Booking OTP Number']).trim()
            : undefined,
          // New Agoda fields
          agodaServiceFee: r['Agoda Service Fee']
            ? String(r['Agoda Service Fee']).trim()
            : undefined,
          agodaCrs: r['Agoda CRS'] ? String(r['Agoda CRS']).trim() : undefined,
          agodaRunDateFrom: dateCol(['Agoda Run Date From', 'Agoda Run Date']),
          agodaRunDateTo: dateCol(['Agoda Run Date To']),
          agodaRevisedDate: dateCol(['Agoda Revised Date']),
          agodaCredentialVerified: parseBool(r['Agoda Credential Verified']),
          agodaOtpNumber: r['Agoda OTP Number']
            ? String(r['Agoda OTP Number']).trim()
            : undefined,
          // Misc
          priority: r['Priority'] ? String(r['Priority']).trim() : undefined,
          expediaPriority: parseOtaPriority(['Expedia Priority']),
          bookingPriority: parseOtaPriority(['Booking Priority']),
          agodaPriority: parseOtaPriority(['Agoda Priority']),
          salesRep: r['Sales Rep'] ? String(r['Sales Rep']).trim() : undefined,
          discontinuedEmailIds: r['Discontinued Email IDs'] ? String(r['Discontinued Email IDs']).trim() : undefined,
          cybersourceMid: r['Cybersource MID'] ? String(r['Cybersource MID']).trim() : undefined,
          adyenLocation: r['Adyen Location'] ? String(r['Adyen Location']).trim() : undefined,
          stripeConnectedEmail: r['Stripe Connected Email'] ? String(r['Stripe Connected Email']).trim() : undefined,
          notes: r['Notes'] ? String(r['Notes']).trim() : undefined
        } satisfies ImportPropertyRow
      })
      .filter(Boolean) as ImportPropertyRow[]

    const result = await this.repo.importProperties(rows, user.id)

    // Auto-calculate run dates for every newly created property that has
    // a historical "to" date and a valid CRS.  Properties are processed
    // sequentially so each calculation reflects all previous updates,
    // which is important for correct capacity-check counts.
    if (result.properties && result.properties.length > 0) {
      for (const property of result.properties) {
        const runDateUpdates =
          await this.runDateCalculator.calcRunDatesForProperty(
            {
              created_at: property.created_at,
              expedia_to: property.expedia_to,
              expedia_crs: property.expedia_crs,
              expedia_priority: property.expedia_priority,
              booking_to: property.booking_to,
              booking_crs: property.booking_crs,
              booking_priority: property.booking_priority,
              agoda_to: property.agoda_to,
              agoda_crs: property.agoda_crs,
              agoda_priority: property.agoda_priority
            },
            property.id
          )
        if (Object.keys(runDateUpdates).length > 0) {
          await this.prisma.property.update({
            where: { id: property.id },
            data: runDateUpdates
          })
          Object.assign(property, runDateUpdates)
        }
      }
    }

    await this.invalidateCaches()
    this.scheduleCacheWarm(user)
    return result
  }

  async importFromExcelAndSync(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPropertiesResult> {
    const result = await this.importFromExcel(file, user)

    const allProperties: any[] = [
      ...(result.properties ?? []),
      ...(result.existingProperties ?? [])
    ]

    if (!allProperties.length) return result

    // Run per-property dashboard + scraper sync and collect row-level results
    // Row numbers: start at 2 (row 1 = header), incrementing per property
    // Skipped rows from import are interleaved so exact row number is approximate
    let rowIndex = 2
    // Build offset for skipped rows so row numbers roughly match the original Excel
    const skippedNames = new Set(
      (result.skippedProperties ?? []).map((s: { name: string }) => s.name)
    )

    const importRows = allProperties.map(p => {
      const row = rowIndex++
      return { property: p as PropertyWithRelations, row }
    })

    const scraperBulkItems = (
      await Promise.all(
        importRows.map(async ({ property, row }) =>
          this.buildScraperBulkUpsertItem(property, row)
        )
      )
    ).filter((item): item is Record<string, unknown> => item !== null)

    const parserBulkResult =
      await this.syncBulkUpsertToScraper(scraperBulkItems)

    const rowResults: SyncBulkUpsertRowResult[] = await Promise.all(
      importRows.map(async ({ property: p, row }) => {
        const identifier = String(
          p.expedia_id ?? p.booking_id ?? p.agoda_id ?? p.id
        )
        const dashboardResult = await this.syncUpsertPropertyToDashboard(
          p
        ).catch(e => ({
          success: false,
          reason: e?.message ?? String(e)
        }))
        const parserResult = this.resolveParserBulkUpsertResult(
          p.id,
          parserBulkResult,
          !!p.portfolio_id
        )

        return {
          row,
          parent_id: p.id,
          name: p.name,
          identifier,
          action: skippedNames.has(p.name) ? 'updated' : 'created',
          dbms: true,
          dashboard: dashboardResult,
          parser: parserResult
        } as SyncBulkUpsertRowResult
      })
    )

    // Add rows that were skipped entirely during DBMS import (DBMS = NO)
    let skipIndex = rowIndex + allProperties.length
    const skippedResults: SyncBulkUpsertRowResult[] = (
      result.skippedProperties ?? []
    ).map((s: { name: string; reason: string }) => ({
      row: skipIndex++,
      parent_id: s.name,
      name: s.name,
      identifier: s.name,
      action: 'failed' as const,
      dbms: false,
      dashboard: { success: false, reason: 'Skipped — DBMS error' },
      parser: { success: false, reason: 'Skipped — DBMS error' },
      error: s.reason
    }))

    const allRowResults = [...rowResults, ...skippedResults].sort(
      (a, b) => a.row - b.row
    )

    // Fire email asynchronously — don't block the response
    const failedRows = allRowResults.filter(
      r => !r.dbms || !r.dashboard.success || !r.parser.success
    )
    const defectiveRows = failedRows.map(r => {
      const reasons: string[] = []
      if (r.error) reasons.push(r.error)
      if (
        !r.dashboard.success &&
        r.dashboard.reason &&
        r.dashboard.reason !== 'Skipped — DBMS error'
      )
        reasons.push(`Dashboard: ${r.dashboard.reason}`)
      if (
        !r.parser.success &&
        r.parser.reason &&
        r.parser.reason !== 'Skipped — DBMS error'
      )
        reasons.push(`Parser: ${r.parser.reason}`)
      const prop = allProperties.find(p => p.id === r.parent_id)
      return {
        Row: r.row,
        'Property Name': r.name,
        Identifier: r.identifier,
        Portfolio: prop?.portfolio?.name ?? '',
        'Expedia ID': prop?.expedia_id ?? '',
        'Booking ID': prop?.booking_id ?? '',
        'Agoda ID': prop?.agoda_id ?? '',
        DBMS: r.dbms ? 'YES' : 'NO',
        Dashboard: r.dashboard.success ? 'YES' : 'NO',
        Parser: r.parser.success ? 'YES' : 'NO',
        Reason: reasons.join('; ') || 'N/A'
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        defectiveRows.length
          ? defectiveRows
          : [{ note: 'All rows synced successfully' }]
      ),
      'Sync Results'
    )
    const excelBuffer = Buffer.from(
      XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    )
    const filename = `import-sync-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    this.emailUtil
      .sendBulkSyncResultEmail(user.email, allRowResults, excelBuffer, filename)
      .catch(e =>
        this.logger.error(
          `[email] import sync report failed: ${e?.message ?? e}`
        )
      )

    return result
  }

  async bulkUpdate(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<BulkUpdateResultDto> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const buffer = file.buffer || (file as any).buffer
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('File buffer is empty')
    }

    const nameLower = file.originalname.toLowerCase()
    if (
      !nameLower.endsWith('.xlsx') &&
      !nameLower.endsWith('.xls') &&
      !nameLower.endsWith('.csv')
    ) {
      throw new BadRequestException(
        'File must be an Excel or CSV file (.xlsx, .xls, or .csv)'
      )
    }

    const result: BulkUpdateResultDto = {
      totalRows: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
      successfulUpdates: []
    }

    // Tracks successfully updated properties for post-loop sync
    const syncQueue: Array<{ rowNumber: number; propertyId: string }> = []

    // Helper to find a column value with flexible header matching (case-insensitive, strips asterisks)
    const findValue = (
      row: Record<string, any>,
      names: string[]
    ): string | undefined => {
      for (const name of names) {
        const val = row[name]
        if (val !== undefined && val !== null && val !== '') {
          const trimmed = String(val).trim()
          if (trimmed !== '') return trimmed
        }
      }
      const rowKeys = Object.keys(row)
      for (const name of names) {
        for (const key of rowKeys) {
          const cleanKey = key.split('*')[0].trim()
          if (cleanKey.toLowerCase() === name.toLowerCase()) {
            const val = row[key]
            if (val !== undefined && val !== null && val !== '') {
              const trimmed = String(val).trim()
              if (trimmed !== '') return trimmed
            }
          }
        }
      }
      return undefined
    }

    // Helper to get raw value (preserves type for dates and numbers)
    const getRawValue = (row: Record<string, any>, names: string[]): any => {
      for (const name of names) {
        const val = row[name]
        if (val !== undefined && val !== null && val !== '') return val
      }
      const rowKeys = Object.keys(row)
      for (const name of names) {
        for (const key of rowKeys) {
          const cleanKey = key.split('*')[0].trim()
          if (cleanKey.toLowerCase() === name.toLowerCase()) {
            const val = row[key]
            if (val !== undefined && val !== null && val !== '') return val
          }
        }
      }
      return undefined
    }

    // Parse date from mm/dd/yyyy string or Excel serial number
    const parseDate = (dateValue: any): Date | null => {
      if (!dateValue) return null
      try {
        if (dateValue instanceof Date) {
          return isNaN(dateValue.getTime()) ? null : dateValue
        }
        if (typeof dateValue === 'number') {
          const excelEpoch = new Date(1899, 11, 30)
          const date = new Date(
            excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000
          )
          return !isNaN(date.getTime()) &&
            date.getFullYear() >= 1900 &&
            date.getFullYear() <= 2100
            ? date
            : null
        }
        const dateString = String(dateValue).trim()
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10)
          const day = parseInt(parts[1], 10)
          const year = parseInt(parts[2], 10)
          if (
            !isNaN(month) &&
            !isNaN(day) &&
            !isNaN(year) &&
            year >= 1900 &&
            year <= 2100
          ) {
            return new Date(year, month - 1, day)
          }
        }
        const date = new Date(dateString)
        return !isNaN(date.getTime()) &&
          date.getFullYear() >= 1900 &&
          date.getFullYear() <= 2100
          ? date
          : null
      } catch {
        return null
      }
    }

    try {
      let workbook: XLSX.WorkBook
      if (nameLower.endsWith('.csv')) {
        workbook = XLSX.read(buffer.toString('utf-8'), { type: 'string' })
      } else {
        workbook = XLSX.read(buffer, { type: 'buffer' })
      }

      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        throw new BadRequestException('File contains no worksheets')
      }

      const worksheet = workbook.Sheets[sheetName]
      const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)

      if (!rawData || rawData.length === 0) {
        throw new BadRequestException('File is empty or contains no data rows')
      }

      // Strip trailing asterisks from header keys (e.g. "Currency *" → "Currency")
      const data: Record<string, any>[] = rawData.map(rawRow => {
        const cleaned: Record<string, any> = {}
        for (const key of Object.keys(rawRow)) {
          cleaned[key.replace(/\s*\*+\s*$/, '').trim()] = rawRow[key]
        }
        return cleaned
      })

      result.totalRows = data.length

      // Fetch accessible IDs once for the whole batch
      const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
      const seenIdentifiersInBatch = new Set<string>()

      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Row 1 is the header in Excel

        try {
          // Match by property_identifier first; fall back to name when not found
          const propertyIdentifierRaw = findValue(row, [
            'Property Identifier',
            'Property identifier',
            'Identifier'
          ])
          const normalizedRowIdentifier = propertyIdentifierRaw
            ? normalizePropertyIdentifier(propertyIdentifierRaw)
            : undefined
          const propertyName = findValue(row, [
            'Property Name',
            'Property name',
            'Name'
          ])

          if (!normalizedRowIdentifier && !propertyName) {
            result.errors.push({
              row: rowNumber,
              propertyName: 'Unknown',
              error: 'Either Property Identifier or Property Name is required'
            })
            result.failureCount++
            continue
          }

          let existingProperty: any
          let matchedByIdentifier = false
          const rowLabel = normalizedRowIdentifier ?? propertyName!

          if (normalizedRowIdentifier) {
            existingProperty = await this.prisma.property.findFirst({
              where: {
                property_identifier: {
                  equals: normalizedRowIdentifier,
                  mode: 'insensitive'
                }
              }
            })
            if (existingProperty) {
              matchedByIdentifier = true
            }
          }

          if (!existingProperty && propertyName) {
            existingProperty = await this.repo.findByName(propertyName)
          }

          if (!existingProperty) {
            result.errors.push({
              row: rowNumber,
              propertyName: rowLabel,
              error: normalizedRowIdentifier
                ? `Property not found with identifier: ${normalizedRowIdentifier}${propertyName ? ` or name: ${propertyName}` : ''}`
                : `Property not found: ${propertyName}`
            })
            result.failureCount++
            continue
          }

          // Check access permission
          if (
            accessibleIds !== 'all' &&
            !accessibleIds.includes(existingProperty.id)
          ) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error: 'You do not have permission to update this property'
            })
            result.failureCount++
            continue
          }

          const propertyId = existingProperty.id
          const updateData: Record<string, any> = {}

          // Normalize to UPPER_SNAKE_CASE (ServiceType and Frequency)
          const toUpperSnakeCase = (val: string): string =>
            val
              .trim()
              .toUpperCase()
              .replace(/[\s\-.]+/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_|_$/, '')

          // Helper functions to resolve names to ObjectIds (find-or-create)
          const resolveProcessor = async (
            name?: string
          ): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.processor.findFirst({
              where: { name: { equals: normalized, mode: 'insensitive' } }
            })
            if (!rec) {
              const last = await this.prisma.processor.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              rec = await this.prisma.processor.create({
                data: {
                  name: normalized,
                  is_active: true,
                  order: (last?.order ?? 0) + 1
                }
              })
            }
            return rec.id
          }
          const resolveServiceType = async (
            name?: string
          ): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = toUpperSnakeCase(name)
            let rec = await this.prisma.serviceType.findFirst({
              where: { type: { equals: normalized, mode: 'insensitive' } }
            })
            if (!rec) {
              const maxOrder = await this.prisma.serviceType.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              rec = await this.prisma.serviceType.create({
                data: {
                  type: normalized,
                  is_active: true,
                  order: (maxOrder?.order ?? 0) + 1
                }
              })
            }
            return rec.id
          }
          const resolveBillingType = async (
            name?: string
          ): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.billingType.findFirst({
              where: { name: { equals: normalized, mode: 'insensitive' } }
            })
            if (!rec) {
              const last = await this.prisma.billingType.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              rec = await this.prisma.billingType.create({
                data: {
                  name: normalized,
                  is_active: true,
                  order: (last?.order ?? 0) + 1
                }
              })
            }
            return rec.id
          }
          const resolveFrequency = async (
            name?: string
          ): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = toUpperSnakeCase(name)
            let rec = await this.prisma.frequency.findFirst({
              where: { name: { equals: normalized, mode: 'insensitive' } }
            })
            if (!rec) {
              const last = await this.prisma.frequency.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              rec = await this.prisma.frequency.create({
                data: {
                  name: normalized,
                  is_active: true,
                  order: (last?.order ?? 0) + 1
                }
              })
            }
            return rec.id
          }
          const resolvePriority = async (
            name?: string
          ): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.priority.findFirst({
              where: { name: { equals: normalized, mode: 'insensitive' } }
            })
            if (!rec) {
              const last = await this.prisma.priority.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              rec = await this.prisma.priority.create({
                data: {
                  name: normalized,
                  is_active: true,
                  order: (last?.order ?? 0) + 1
                }
              })
            }
            return rec.id
          }

          // Rename: only possible when matched by property_identifier.
          // The "Property Name" column then carries the new name.
          if (
            matchedByIdentifier &&
            propertyName &&
            propertyName !== existingProperty.name
          ) {
            updateData.name = propertyName
          }

          // Assign property_identifier only when matched by name and the property has no identifier yet
          if (!matchedByIdentifier && normalizedRowIdentifier) {
            const existingIdentifier = existingProperty.property_identifier
            const hasExistingIdentifier =
              existingIdentifier !== null &&
              existingIdentifier !== undefined &&
              String(existingIdentifier).trim() !== ''

            if (hasExistingIdentifier) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error:
                  'Property identifier already exists and cannot be updated'
              })
              result.failureCount++
              continue
            }

            if (!propertyName) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error:
                  'Property Name is required to assign a property identifier'
              })
              result.failureCount++
              continue
            }

            const identifierKey = propertyIdentifierKey(normalizedRowIdentifier)
            if (seenIdentifiersInBatch.has(identifierKey)) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error: `Duplicate property identifier in file: ${normalizedRowIdentifier}`
              })
              result.failureCount++
              continue
            }

            updateData.property_identifier = normalizedRowIdentifier
            seenIdentifiersInBatch.add(identifierKey)
          }

          // Hotel address
          const hotelAddress = findValue(row, [
            'Hotel Address',
            'Hotel address',
            'Address',
            'Property Address'
          ])
          if (hotelAddress !== undefined)
            updateData.hotel_address = hotelAddress

          // Card descriptor
          const cardDescriptor = findValue(row, [
            'Card Descriptor',
            'Card descriptor',
            'Descriptor'
          ])
          if (cardDescriptor !== undefined)
            updateData.card_descriptor = cardDescriptor

          // Description
          const description = findValue(row, ['Description', 'Desc'])
          if (description !== undefined) updateData.description = description

          // Service type
          const serviceType = findValue(row, ['Service Type', 'Service type'])
          if (serviceType !== undefined)
            updateData.service_type_id = await resolveServiceType(serviceType)

          // Currency — resolve code → currency_id (find or create)
          const currencyCode = findValue(row, ['Currency', 'currency'])
          if (currencyCode !== undefined) {
            const normalized = currencyCode.trim().toUpperCase()
            let currencyRec = await this.prisma.currency.findFirst({
              where: { code: { equals: normalized, mode: 'insensitive' } }
            })
            if (!currencyRec) {
              const last = await this.prisma.currency.findFirst({
                orderBy: { order: 'desc' },
                select: { order: true }
              })
              currencyRec = await this.prisma.currency.create({
                data: {
                  code: normalized,
                  name: normalized,
                  is_active: true,
                  order: (last?.order ?? 0) + 1
                }
              })
            }
            updateData.currency_id = currencyRec.id
          }

          // Next due date
          const nextDueDateRaw = getRawValue(row, [
            'Next Due Date',
            'Next due date',
            'Due Date'
          ])
          if (nextDueDateRaw) {
            const nextDueDate = parseDate(nextDueDateRaw)
            if (!nextDueDate) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error:
                  'Invalid date format for Next Due Date (expected mm/dd/yyyy)'
              })
              result.failureCount++
              continue
            }
            updateData.next_due_date = nextDueDate.toISOString()
          }

          // Portfolio (look up by name)
          const portfolioName = findValue(row, [
            'Portfolio',
            'Portfolio Name',
            'Portfolio name'
          ])
          if (portfolioName) {
            const portfolio = await this.prisma.portfolio.findFirst({
              where: { name: portfolioName }
            })
            if (!portfolio) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error: `Portfolio not found: ${portfolioName}`
              })
              result.failureCount++
              continue
            }
            updateData.portfolio_id = portfolio.id
          }

          const subportfolioName = findValue(row, [
            'Sub Portfolio',
            'Subportfolio',
            'Sub Portfolio Name'
          ])
          if (subportfolioName !== undefined && subportfolioName.trim()) {
            const portfolioId =
              updateData.portfolio_id ?? existingProperty.portfolio_id
            if (!portfolioId) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error:
                  'Portfolio is required before assigning a Sub Portfolio'
              })
              result.failureCount++
              continue
            }
            const subName = subportfolioName.trim()
            let subportfolio = await this.prisma.subportfolio.findUnique({
              where: { name: subName }
            })
            if (!subportfolio) {
              try {
                subportfolio = await this.prisma.subportfolio.create({
                  data: { name: subName, portfolio_id: portfolioId }
                })
              } catch (err: any) {
                result.errors.push({
                  row: rowNumber,
                  propertyName: existingProperty.name,
                  error: `Error creating subportfolio: ${err.message}`
                })
                result.failureCount++
                continue
              }
            } else if (subportfolio.portfolio_id !== portfolioId) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error: `Subportfolio "${subName}" belongs to a different portfolio`
              })
              result.failureCount++
              continue
            }
            updateData.subportfolio_id = subportfolio.id
          }

          // Case management contact
          const caseContact = findValue(row, [
            'Case Management Contact',
            'Case management contact',
            'Case Contact'
          ])
          if (caseContact !== undefined)
            updateData.case_management_contact = caseContact

          // Access contact
          const accessContact = findValue(row, [
            'Access Contact',
            'Access contact'
          ])
          if (accessContact !== undefined)
            updateData.access_contact = accessContact

          // Reporting contact
          const reportingContact = findValue(row, [
            'Reporting Contact',
            'Reporting contact'
          ])
          if (reportingContact !== undefined)
            updateData.reporting_contact = reportingContact

          // Processors
          const expediaProcessor = findValue(row, [
            'Expedia Processor',
            'Expedia processor'
          ])
          if (expediaProcessor !== undefined)
            updateData.expedia_processor_id =
              await resolveProcessor(expediaProcessor)

          const bookingProcessor = findValue(row, [
            'Booking Processor',
            'Booking processor'
          ])
          if (bookingProcessor !== undefined)
            updateData.booking_processor_id =
              await resolveProcessor(bookingProcessor)

          const agodaProcessor = findValue(row, [
            'Agoda Processor',
            'Agoda processor'
          ])
          if (agodaProcessor !== undefined)
            updateData.agoda_processor_id =
              await resolveProcessor(agodaProcessor)

          // FP MID
          const fpMid = findValue(row, ['FP MID', 'FP Mid', 'fp_mid'])
          if (fpMid !== undefined) updateData.fp_mid = fpMid

          // Stripe account email
          const stripeEmail = findValue(row, [
            'Stripe Account Email',
            'Stripe account email',
            'Stripe Email'
          ])
          if (stripeEmail !== undefined)
            updateData.stripe_account_email = stripeEmail

          // New domains email
          const newDomainsEmail = findValue(row, [
            'New Domains Email',
            'New domains email',
            'new_domain_email'
          ])
          if (newDomainsEmail !== undefined)
            updateData.new_domain_email = newDomainsEmail

          // Portfolio contact
          const portfolioContact = findValue(row, [
            'Portfolio Contact',
            'Portfolio contact'
          ])
          if (portfolioContact !== undefined)
            updateData.portfolio_contact = portfolioContact

          // Portfolio contact email
          const portfolioContactEmail = findValue(row, [
            'Portfolio Contact Email',
            'Portfolio contact email'
          ])
          if (portfolioContactEmail !== undefined)
            updateData.portfolio_contact_email = portfolioContactEmail

          // is_active flag
          const isActiveStr = findValue(row, [
            'Is Active',
            'is_active',
            'Active'
          ])
          if (isActiveStr !== undefined) {
            const lower = isActiveStr.toLowerCase()
            if (lower === 'true' || lower === '1' || lower === 'yes')
              updateData.is_active = true
            else if (lower === 'false' || lower === '0' || lower === 'no')
              updateData.is_active = false
          }

          // Helper: parse boolean cell values
          const parseBoolCell = (
            val: string | undefined
          ): boolean | undefined => {
            if (val === undefined) return undefined
            const l = val.toLowerCase()
            if (l === 'true' || l === '1' || l === 'yes') return true
            if (l === 'false' || l === '0' || l === 'no') return false
            return undefined
          }

          // ── Expedia OTA fields ─────────────────────────────────────────────
          const expediaIdVal = findValue(row, ['Expedia ID', 'Expedia id'])
          if (expediaIdVal !== undefined) {
            const n = parseInt(expediaIdVal)
            if (!isNaN(n)) updateData.expedia_id = n
          }
          const expediaStatus = findValue(row, [
            'Expedia Status',
            'Expedia status'
          ])
          if (expediaStatus !== undefined)
            updateData.expedia_status = expediaStatus
          const expediaBillingType = findValue(row, [
            'Expedia Billing Type',
            'Expedia billing type'
          ])
          if (expediaBillingType !== undefined)
            updateData.expedia_billing_type_id =
              await resolveBillingType(expediaBillingType)
          const expediaServiceType = findValue(row, [
            'Expedia Service Type',
            'Expedia service type'
          ])
          if (expediaServiceType !== undefined)
            updateData.expedia_service_type_id =
              await resolveServiceType(expediaServiceType)
          const expediaFrequency = findValue(row, [
            'Expedia Frequency',
            'Expedia frequency'
          ])
          if (expediaFrequency !== undefined)
            updateData.expedia_frequency_id =
              await resolveFrequency(expediaFrequency)
          const priorityVal = findValue(row, ['Priority', 'priority'])
          if (priorityVal !== undefined)
            updateData.priority_id = await resolvePriority(priorityVal)
          const expediaPriorityVal = findValue(row, [
            'Expedia Priority',
            'Expedia priority'
          ])
          if (expediaPriorityVal !== undefined)
            updateData.expedia_priority = expediaPriorityVal.trim().toUpperCase()
          const bookingPriorityVal = findValue(row, [
            'Booking Priority',
            'Booking priority'
          ])
          if (bookingPriorityVal !== undefined)
            updateData.booking_priority = bookingPriorityVal.trim().toUpperCase()
          const agodaPriorityVal = findValue(row, [
            'Agoda Priority',
            'Agoda priority'
          ])
          if (agodaPriorityVal !== undefined)
            updateData.agoda_priority = agodaPriorityVal.trim().toUpperCase()
          const expediaAccessLevelBool = parseBoolCell(
            findValue(row, ['Expedia Access Level', 'Expedia access level'])
          )
          if (expediaAccessLevelBool !== undefined)
            updateData.expedia_access_level = expediaAccessLevelBool
          const expediaFrom = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.expediaFrom,
            'Expedia from'
          ])
          if (expediaFrom !== undefined) updateData.expedia_from = expediaFrom
          const expediaTo = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.expediaTo,
            'Expedia to'
          ])
          if (expediaTo !== undefined) updateData.expedia_to = expediaTo
          const expediaSchedulerBool = parseBoolCell(
            findValue(row, ['Expedia Scheduler', 'Expedia scheduler'])
          )
          if (expediaSchedulerBool !== undefined)
            updateData.expedia_scheduler = expediaSchedulerBool
          const expediaDurationVal = findValue(row, [
            'Expedia Duration',
            'Expedia duration'
          ])
          if (expediaDurationVal !== undefined) {
            const n = parseInt(expediaDurationVal)
            if (!isNaN(n)) updateData.expedia_duration = n
          }
          const expediaServiceFeeVal = findValue(row, [
            'Expedia Service Fee',
            'Expedia service fee'
          ])
          if (expediaServiceFeeVal !== undefined) {
            const n = parseInt(expediaServiceFeeVal)
            if (!isNaN(n)) updateData.expedia_service_fee = n
          }
          const expediaCrs = findValue(row, ['Expedia CRS', 'Expedia crs'])
          if (expediaCrs !== undefined) updateData.expedia_crs = expediaCrs
          const expediaCrsDb = findValue(row, [
            'Expedia CRS DB',
            'Expedia crs db'
          ])
          if (expediaCrsDb !== undefined)
            updateData.expedia_crs_db = expediaCrsDb
          const expediaRunDateFrom = findExcelDateValue(row, [
            'Expedia Run Date From',
            'Expedia run date from',
            'Expedia Run Date',
            'Expedia run date'
          ])
          if (expediaRunDateFrom !== undefined)
            updateData.expedia_run_date = expediaRunDateFrom
          const expediaRunDateDbFrom = findExcelDateValue(row, [
            'Expedia Run Date DB From',
            'Expedia run date db from',
            'Expedia Run Date DB',
            'Expedia run date db'
          ])
          if (expediaRunDateDbFrom !== undefined)
            updateData.expedia_run_date_db = expediaRunDateDbFrom
          const expediaRevisedDate = findExcelDateValue(row, [
            'Expedia Revised Date',
            'Expedia revised date'
          ])
          if (expediaRevisedDate !== undefined)
            updateData.expedia_revised_date = expediaRevisedDate
          const expediaSchedulerReviewFrom = findExcelDateValue(row, [
            'Expedia Scheduler Review From',
            'Expedia scheduler review from'
          ])
          if (expediaSchedulerReviewFrom !== undefined)
            updateData.expedia_scheduler_review_from =
              expediaSchedulerReviewFrom
          const expediaSchedulerReviewTo = findExcelDateValue(row, [
            'Expedia Scheduler Review To',
            'Expedia scheduler review to'
          ])
          if (expediaSchedulerReviewTo !== undefined)
            updateData.expedia_scheduler_review_to = expediaSchedulerReviewTo
          const expediaSchedulerDb = findValue(row, [
            'Expedia Scheduler DB',
            'Expedia scheduler db'
          ])
          if (expediaSchedulerDb !== undefined)
            updateData.expedia_scheduler_db = expediaSchedulerDb
          const expediaSchedulerReviewDbFrom = findExcelDateValue(row, [
            'Expedia Scheduler Review DB From',
            'Expedia scheduler review db from'
          ])
          if (expediaSchedulerReviewDbFrom !== undefined)
            updateData.expedia_scheduler_review_db_from =
              expediaSchedulerReviewDbFrom
          const expediaSchedulerReviewDbTo = findExcelDateValue(row, [
            'Expedia Scheduler Review DB To',
            'Expedia scheduler review db to'
          ])
          if (expediaSchedulerReviewDbTo !== undefined)
            updateData.expedia_scheduler_review_db_to =
              expediaSchedulerReviewDbTo
          const expediaDbDurationVal = findValue(row, [
            'Expedia DB Duration',
            'Expedia db duration'
          ])
          if (expediaDbDurationVal !== undefined) {
            const n = parseInt(expediaDbDurationVal)
            if (!isNaN(n)) updateData.expedia_db_duration = n
          }
          const expediaCredVerified = parseBoolCell(
            findValue(row, [
              'Expedia Credential Verified',
              'Expedia credential verified'
            ])
          )
          if (expediaCredVerified !== undefined)
            updateData.expedia_credential_verified = expediaCredVerified
          const expediaOtpNumber = findValue(row, [
            'Expedia OTP Number',
            'Expedia otp number'
          ])
          if (expediaOtpNumber !== undefined)
            updateData.expedia_otp_number = expediaOtpNumber

          // Expedia historical DB dates
          const fromDb = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.expediaDbFrom,
            'From db'
          ])
          if (fromDb !== undefined) updateData.from_db = fromDb
          const toDb = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.expediaDbTo,
            'To db'
          ])
          if (toDb !== undefined) updateData.to_db = toDb

          // ── Booking OTA fields ────────────────────────────────────────────
          const bookingIdVal = findValue(row, ['Booking ID', 'Booking id'])
          if (bookingIdVal !== undefined) {
            const n = parseInt(bookingIdVal)
            if (!isNaN(n)) updateData.booking_id = n
          }
          const bookingStatus = findValue(row, [
            'Booking Status',
            'Booking status'
          ])
          if (bookingStatus !== undefined)
            updateData.booking_status = bookingStatus
          const bookingBillingType = findValue(row, [
            'Booking Billing Type',
            'Booking billing type'
          ])
          if (bookingBillingType !== undefined)
            updateData.booking_billing_type_id =
              await resolveBillingType(bookingBillingType)
          const bookingServiceType = findValue(row, [
            'Booking Service Type',
            'Booking service type'
          ])
          if (bookingServiceType !== undefined)
            updateData.booking_service_type_id =
              await resolveServiceType(bookingServiceType)
          const bookingFrequency = findValue(row, [
            'Booking Frequency',
            'Booking frequency'
          ])
          if (bookingFrequency !== undefined)
            updateData.booking_frequency_id =
              await resolveFrequency(bookingFrequency)
          const bookingAccessLevelBool = parseBoolCell(
            findValue(row, ['Booking Access Level', 'Booking access level'])
          )
          if (bookingAccessLevelBool !== undefined)
            updateData.booking_access_level = bookingAccessLevelBool
          const bookingFrom = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.bookingFrom,
            'Booking from'
          ])
          if (bookingFrom !== undefined) updateData.booking_from = bookingFrom
          const bookingTo = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.bookingTo,
            'Booking to'
          ])
          if (bookingTo !== undefined) updateData.booking_to = bookingTo
          const bookingSchedulerBool = parseBoolCell(
            findValue(row, ['Booking Scheduler', 'Booking scheduler'])
          )
          if (bookingSchedulerBool !== undefined)
            updateData.booking_scheduler = bookingSchedulerBool
          const bookingDurationVal = findValue(row, [
            'Booking Duration',
            'Booking duration'
          ])
          if (bookingDurationVal !== undefined) {
            const n = parseInt(bookingDurationVal)
            if (!isNaN(n)) updateData.booking_duration = n
          }
          const bookingServiceFeeVal = findValue(row, [
            'Booking Service Fee',
            'Booking service fee'
          ])
          if (bookingServiceFeeVal !== undefined) {
            const n = parseInt(bookingServiceFeeVal)
            if (!isNaN(n)) updateData.booking_service_fee = n
          }
          const bookingCrs = findValue(row, ['Booking CRS', 'Booking crs'])
          if (bookingCrs !== undefined) updateData.booking_crs = bookingCrs
          const bookingRunDateFrom = findExcelDateValue(row, [
            'Booking Run Date From',
            'Booking run date from',
            'Booking Run Date',
            'Booking run date'
          ])
          if (bookingRunDateFrom !== undefined)
            updateData.booking_run_date = bookingRunDateFrom
          const bookingRevisedDate = findExcelDateValue(row, [
            'Booking Revised Date',
            'Booking revised date'
          ])
          if (bookingRevisedDate !== undefined)
            updateData.booking_revised_date = bookingRevisedDate
          const bookingCredVerified = parseBoolCell(
            findValue(row, [
              'Booking Credential Verified',
              'Booking credential verified'
            ])
          )
          if (bookingCredVerified !== undefined)
            updateData.booking_credential_verified = bookingCredVerified
          const bookingOtpNumber = findValue(row, [
            'Booking OTP Number',
            'Booking otp number'
          ])
          if (bookingOtpNumber !== undefined)
            updateData.booking_otp_number = bookingOtpNumber
          const bookingOtpPhone = findValue(row, [
            'Booking OTP Phone',
            'Booking otp phone'
          ])
          if (bookingOtpPhone !== undefined)
            updateData.booking_otp_phone = bookingOtpPhone

          // ── Agoda OTA fields ──────────────────────────────────────────────
          const agodaIdVal = findValue(row, ['Agoda ID', 'Agoda id'])
          if (agodaIdVal !== undefined) {
            const n = parseInt(agodaIdVal)
            if (!isNaN(n)) updateData.agoda_id = n
          }
          const agodaStatus = findValue(row, ['Agoda Status', 'Agoda status'])
          if (agodaStatus !== undefined) updateData.agoda_status = agodaStatus
          const agodaBillingType = findValue(row, [
            'Agoda Billing Type',
            'Agoda billing type'
          ])
          if (agodaBillingType !== undefined)
            updateData.agoda_billing_type_id =
              await resolveBillingType(agodaBillingType)
          const agodaServiceType = findValue(row, [
            'Agoda Service Type',
            'Agoda service type'
          ])
          if (agodaServiceType !== undefined)
            updateData.agoda_service_type_id =
              await resolveServiceType(agodaServiceType)
          const agodaFrequency = findValue(row, [
            'Agoda Frequency',
            'Agoda frequency'
          ])
          if (agodaFrequency !== undefined)
            updateData.agoda_frequency_id =
              await resolveFrequency(agodaFrequency)
          const agodaAccessLevelBool = parseBoolCell(
            findValue(row, ['Agoda Access Level', 'Agoda access level'])
          )
          if (agodaAccessLevelBool !== undefined)
            updateData.agoda_access_level = agodaAccessLevelBool
          const agodaFrom = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.agodaFrom,
            'Agoda from'
          ])
          if (agodaFrom !== undefined) updateData.agoda_from = agodaFrom
          const agodaTo = findExcelDateValue(row, [
            ...EXCEL_HISTORICAL_DATE_HEADERS.agodaTo,
            'Agoda to'
          ])
          if (agodaTo !== undefined) updateData.agoda_to = agodaTo
          const agodaSchedulerBool = parseBoolCell(
            findValue(row, ['Agoda Scheduler', 'Agoda scheduler'])
          )
          if (agodaSchedulerBool !== undefined)
            updateData.agoda_scheduler = agodaSchedulerBool
          const agodaDurationVal = findValue(row, [
            'Agoda Duration',
            'Agoda duration'
          ])
          if (agodaDurationVal !== undefined) {
            const n = parseInt(agodaDurationVal)
            if (!isNaN(n)) updateData.agoda_duration = n
          }
          const agodaServiceFeeVal = findValue(row, [
            'Agoda Service Fee',
            'Agoda service fee'
          ])
          if (agodaServiceFeeVal !== undefined) {
            const n = parseInt(agodaServiceFeeVal)
            if (!isNaN(n)) updateData.agoda_service_fee = n
          }
          const agodaCrs = findValue(row, ['Agoda CRS', 'Agoda crs'])
          if (agodaCrs !== undefined) updateData.agoda_crs = agodaCrs
          const agodaRunDateFrom = findExcelDateValue(row, [
            'Agoda Run Date From',
            'Agoda run date from',
            'Agoda Run Date',
            'Agoda run date'
          ])
          if (agodaRunDateFrom !== undefined)
            updateData.agoda_run_date = agodaRunDateFrom
          const agodaRevisedDate = findExcelDateValue(row, [
            'Agoda Revised Date',
            'Agoda revised date'
          ])
          if (agodaRevisedDate !== undefined)
            updateData.agoda_revised_date = agodaRevisedDate
          const agodaCredVerified = parseBoolCell(
            findValue(row, [
              'Agoda Credential Verified',
              'Agoda credential verified'
            ])
          )
          if (agodaCredVerified !== undefined)
            updateData.agoda_credential_verified = agodaCredVerified
          const agodaOtpNumber = findValue(row, [
            'Agoda OTP Number',
            'Agoda otp number'
          ])
          if (agodaOtpNumber !== undefined)
            updateData.agoda_otp_number = agodaOtpNumber

          // ── Misc fields ───────────────────────────────────────────────────
          const needAnotherDomain = parseBoolCell(
            findValue(row, ['Need Another Domain', 'Need another domain'])
          )
          if (needAnotherDomain !== undefined)
            updateData.need_another_domain = needAnotherDomain
          const salesRep = findValue(row, ['Sales Rep', 'Sales rep'])
          if (salesRep !== undefined) updateData.sales_rep = salesRep
          const discontinuedEmailIds = findValue(row, ['Discontinued Email IDs', 'Discontinued Email Ids'])
          if (discontinuedEmailIds !== undefined) {
            updateData.discontinued_email_ids = discontinuedEmailIds
              .split(',')
              .map((e: string) => e.trim())
              .filter(Boolean)
          }
          const cybersourceMid = findValue(row, ['Cybersource MID', 'Cybersource Mid'])
          if (cybersourceMid !== undefined) updateData.cybersource_mid = cybersourceMid
          const adyenLocation = findValue(row, ['Adyen Location', 'Adyen location'])
          if (adyenLocation !== undefined) updateData.adyen_location = adyenLocation
          const stripeConnectedEmail = findValue(row, ['Stripe Connected Email', 'Stripe connected email'])
          if (stripeConnectedEmail !== undefined) updateData.stripe_connected_email = stripeConnectedEmail
          const caseContactEmail = findValue(row, ['Case Contact Email', 'Case contact email', 'Primary Case Email'])
          if (caseContactEmail !== undefined) updateData.primary_case_email = caseContactEmail

          // ── QP / FP credentials (stored on Property, encrypted) ───────────
          const qpUsername = findValue(row, ['Qp Username', 'QP Username'])
          if (qpUsername !== undefined) updateData.qp_username = qpUsername
          const qpPasswordVal = findValue(row, ['Qp Password', 'QP Password'])
          if (qpPasswordVal !== undefined)
            updateData.qp_password = this.encryptionUtil.encrypt(qpPasswordVal)
          const qpApiKeyVal = findValue(row, [
            'Qp Api Key',
            'QP Api Key',
            'QP API Key'
          ])
          if (qpApiKeyVal !== undefined)
            updateData.qp_api_key = this.encryptionUtil.encrypt(qpApiKeyVal)
          const fpUsernameVal = findValue(row, ['FP Username', 'Fp Username'])
          if (fpUsernameVal !== undefined)
            updateData.fp_username = fpUsernameVal
          const fpPasswordVal = findValue(row, ['FP Password', 'Fp Password'])
          if (fpPasswordVal !== undefined)
            updateData.fp_password = this.encryptionUtil.encrypt(fpPasswordVal)
          const webmailPasswordVal = findValue(row, [
            'Webmail Password',
            'Webmail password'
          ])
          if (webmailPasswordVal !== undefined)
            updateData.webmail_password =
              this.encryptionUtil.encrypt(webmailPasswordVal)

          // ── Credential fields (PropertyCredentials collection) ─────────────
          const expediaUsername = findValue(row, [
            'Expedia Username',
            'Expedia username'
          ])
          const expediaPassword = findValue(row, [
            'Expedia Password',
            'Expedia password'
          ])
          const agodaUsername = findValue(row, [
            'Agoda Username',
            'Agoda username'
          ])
          const agodaPassword = findValue(row, [
            'Agoda Password',
            'Agoda password'
          ])
          const bookingUsername = findValue(row, [
            'Booking Username',
            'Booking username'
          ])
          const bookingPassword = findValue(row, [
            'Booking Password',
            'Booking password'
          ])
          const expediaSecondaryUsername = findValue(row, [
            'Expedia Secondary Username',
            'Expedia secondary username'
          ])
          const expediaSecondaryPassword = findValue(row, [
            'Expedia Secondary Password',
            'Expedia secondary password'
          ])
          const bookingSecondaryUsername = findValue(row, [
            'Booking Secondary Username',
            'Booking secondary username'
          ])
          const bookingSecondaryPassword = findValue(row, [
            'Booking Secondary Password',
            'Booking secondary password'
          ])
          const agodaSecondaryUsername = findValue(row, [
            'Agoda Secondary Username',
            'Agoda secondary username'
          ])
          const agodaSecondaryPassword = findValue(row, [
            'Agoda Secondary Password',
            'Agoda secondary password'
          ])

          // Validate credential pairs: if one is provided, the other must be too
          if (!!expediaUsername !== !!expediaPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error: 'Expedia username and password must be provided together'
            })
            result.failureCount++
            continue
          }
          if (!!agodaUsername !== !!agodaPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error: 'Agoda username and password must be provided together'
            })
            result.failureCount++
            continue
          }
          if (!!bookingUsername !== !!bookingPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error: 'Booking username and password must be provided together'
            })
            result.failureCount++
            continue
          }
          if (!!expediaSecondaryUsername !== !!expediaSecondaryPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error:
                'Expedia secondary username and password must be provided together'
            })
            result.failureCount++
            continue
          }
          if (!!bookingSecondaryUsername !== !!bookingSecondaryPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error:
                'Booking secondary username and password must be provided together'
            })
            result.failureCount++
            continue
          }
          if (!!agodaSecondaryUsername !== !!agodaSecondaryPassword) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error:
                'Agoda secondary username and password must be provided together'
            })
            result.failureCount++
            continue
          }

          const hasCredentialsUpdate =
            expediaUsername ||
            expediaPassword ||
            agodaUsername ||
            agodaPassword ||
            bookingUsername ||
            bookingPassword ||
            expediaSecondaryUsername ||
            expediaSecondaryPassword ||
            bookingSecondaryUsername ||
            bookingSecondaryPassword ||
            agodaSecondaryUsername ||
            agodaSecondaryPassword

          const hasPropertyUpdate = Object.keys(updateData).length > 0

          if (!hasPropertyUpdate && !hasCredentialsUpdate) {
            result.errors.push({
              row: rowNumber,
              propertyName: existingProperty.name,
              error: 'No fields to update (all cells are empty)'
            })
            result.failureCount++
            continue
          }

          // Apply property-level update
          if (hasPropertyUpdate) {
            const uniqueConflicts = await collectPropertyUniqueConflicts(
              this.prisma,
              {
                name: updateData.name,
                property_identifier: updateData.property_identifier,
                expedia_id: updateData.expedia_id,
                booking_id: updateData.booking_id,
                agoda_id: updateData.agoda_id
              },
              propertyId
            )
            if (uniqueConflicts.length) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error: uniqueConflicts.join('; ')
              })
              result.failureCount++
              continue
            }

            await this.repo.update(propertyId, updateData)
          }

          // Apply credentials update
          if (hasCredentialsUpdate) {
            const credentialsData: Record<string, any> = {}
            if (expediaUsername !== undefined)
              credentialsData.expediaUsername = expediaUsername
            if (expediaPassword)
              credentialsData.expediaPassword =
                this.encryptionUtil.encrypt(expediaPassword)
            if (agodaUsername !== undefined)
              credentialsData.agodaUsername = agodaUsername
            if (agodaPassword)
              credentialsData.agodaPassword =
                this.encryptionUtil.encrypt(agodaPassword)
            if (bookingUsername !== undefined)
              credentialsData.bookingUsername = bookingUsername
            if (bookingPassword)
              credentialsData.bookingPassword =
                this.encryptionUtil.encrypt(bookingPassword)
            if (expediaSecondaryUsername !== undefined)
              credentialsData.expediaSecondaryUsername =
                expediaSecondaryUsername
            if (expediaSecondaryPassword)
              credentialsData.expediaSecondaryPassword =
                this.encryptionUtil.encrypt(expediaSecondaryPassword)
            if (bookingSecondaryUsername !== undefined)
              credentialsData.bookingSecondaryUsername =
                bookingSecondaryUsername
            if (bookingSecondaryPassword)
              credentialsData.bookingSecondaryPassword =
                this.encryptionUtil.encrypt(bookingSecondaryPassword)
            if (agodaSecondaryUsername !== undefined)
              credentialsData.agodaSecondaryUsername = agodaSecondaryUsername
            if (agodaSecondaryPassword)
              credentialsData.agodaSecondaryPassword =
                this.encryptionUtil.encrypt(agodaSecondaryPassword)

            const existingCredentials =
              await this.credentialsService.findByPropertyId(propertyId)
            if (existingCredentials) {
              await this.credentialsService.update(
                existingCredentials.id,
                credentialsData
              )
            } else {
              await this.credentialsService.create({
                ...credentialsData,
                property_id: propertyId
              })
            }
          }

          // Invalidate Redis cache for this property and the all-properties list
          await Promise.all([
            this.redisService.del(CACHE_KEY(propertyId)),
            this.invalidateCaches()
          ])

          result.successCount++
          result.successfulUpdates.push(existingProperty.name)
          syncQueue.push({ rowNumber, propertyId: existingProperty.id })
        } catch (error) {
          const nameFromRow =
            findValue(row, [
              'Property Identifier',
              'Property identifier',
              'Identifier'
            ]) ||
            findValue(row, ['Property Name', 'Property name', 'Name']) ||
            'Unknown'
          result.errors.push({
            row: rowNumber,
            propertyName: nameFromRow,
            error:
              error instanceof Error ? error.message : 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      // ── Post-loop: dashboard sync per property + parser bulk upsert ──
      if (syncQueue.length > 0) {
        const updateRows = await Promise.all(
          syncQueue.map(async ({ rowNumber, propertyId }) => {
            const p = (await this.repo.findById(
              propertyId
            )) as PropertyWithRelations | null
            return { rowNumber, propertyId, property: p }
          })
        )

        const scraperBulkItems = (
          await Promise.all(
            updateRows.map(async ({ property, rowNumber }) =>
              property
                ? this.buildScraperBulkUpsertItem(property, rowNumber)
                : null
            )
          )
        ).filter((item): item is Record<string, unknown> => item !== null)

        const parserBulkResult =
          await this.syncBulkUpsertToScraper(scraperBulkItems)

        const rowResults: SyncBulkUpsertRowResult[] = await Promise.all(
          updateRows.map(async ({ rowNumber, propertyId, property: p }) => {
            const identifier = String(
              p?.expedia_id ?? p?.booking_id ?? p?.agoda_id ?? propertyId
            )
            const dashboardResult = p
              ? await this.syncUpsertPropertyToDashboard(p).catch(e => ({
                  success: false,
                  reason: e?.message ?? String(e)
                }))
              : {
                  success: false,
                  reason: 'Property not found after update'
                }
            const parserResult = p
              ? this.resolveParserBulkUpsertResult(
                  propertyId,
                  parserBulkResult,
                  !!p.portfolio_id
                )
              : {
                  success: false,
                  reason: 'Property not found after update'
                }

            return {
              row: rowNumber,
              parent_id: propertyId,
              name: p?.name ?? propertyId,
              identifier,
              action: 'updated' as const,
              dbms: true,
              dashboard: dashboardResult,
              parser: parserResult
            }
          })
        )

        // Add rows that failed at DBMS level (not found, no access, etc.)
        const dbmsFailedResults: SyncBulkUpsertRowResult[] = result.errors.map(
          e => ({
            row: e.row,
            parent_id: e.propertyName,
            name: e.propertyName,
            identifier: e.propertyName,
            action: 'failed' as const,
            dbms: false,
            dashboard: { success: false, reason: 'Skipped — DBMS error' },
            parser: { success: false, reason: 'Skipped — DBMS error' },
            error: e.error
          })
        )

        const allRowResults = [...dbmsFailedResults, ...rowResults].sort(
          (a, b) => a.row - b.row
        )

        const failedRows = allRowResults.filter(
          r => !r.dbms || !r.dashboard.success || !r.parser.success
        )
        const defectRows = failedRows.map(r => {
          const reasons: string[] = []
          if (r.error) reasons.push(r.error)
          if (
            !r.dashboard.success &&
            r.dashboard.reason &&
            r.dashboard.reason !== 'Skipped — DBMS error'
          )
            reasons.push(`Dashboard: ${r.dashboard.reason}`)
          if (
            !r.parser.success &&
            r.parser.reason &&
            r.parser.reason !== 'Skipped — DBMS error'
          )
            reasons.push(`Parser: ${r.parser.reason}`)
          return {
            Row: r.row,
            'Property Name': r.name,
            Identifier: r.identifier,
            DBMS: r.dbms ? 'YES' : 'NO',
            Dashboard: r.dashboard.success ? 'YES' : 'NO',
            Parser: r.parser.success ? 'YES' : 'NO',
            Reason: reasons.join('; ') || 'N/A'
          }
        })

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            defectRows.length
              ? defectRows
              : [{ note: 'All rows synced successfully' }]
          ),
          'Sync Results'
        )
        const excelBuffer = Buffer.from(
          XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
        )
        const filename = `bulk-update-sync-report-${new Date().toISOString().slice(0, 10)}.xlsx`

        this.emailUtil
          .sendBulkSyncResultEmail(
            user.email,
            allRowResults,
            excelBuffer,
            filename
          )
          .catch(e =>
            this.logger.error(
              `[email] bulk-update sync report failed: ${e?.message ?? e}`
            )
          )
      }

      if (result.successCount > 0) {
        this.scheduleCacheWarm(user)
      }

      return result
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException(
        `Failed to process file: ${(error as Error).message}`
      )
    }
  }

  async bulkDelete(
    ids: string[],
    user: IUserWithPermissions
  ): Promise<import('./property.interface').BulkDeleteResult> {
    this.logger.log(
      `User ${user.email} attempting to bulk delete ${ids.length} properties`
    )

    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)

    const success: Array<{ id: string; name: string }> = []
    const skipped: Array<{ id: string; name?: string; reason: string }> = []

    for (const id of ids) {
      if (accessibleIds !== 'all' && !accessibleIds.includes(id)) {
        skipped.push({
          id,
          reason: 'No access to this property'
        })
        continue
      }

      try {
        const property = await this.repo.findById(id)

        if (!property) {
          skipped.push({
            id,
            reason: 'Property not found'
          })
          continue
        }

        await this.repo.delete(id)
        success.push({ id: property.id, name: property.name })
      } catch (err: any) {
        this.logger.error(`Error deleting property ${id}: ${err.message}`)
        skipped.push({
          id,
          name: undefined,
          reason: `Error: ${err.message}`
        })
      }
    }

    this.logger.log(
      `Bulk delete completed: ${success.length} success, ${skipped.length} skipped`
    )

    if (success.length > 0) {
      await Promise.all([
        ...success.map(({ id }) => this.redisService.del(CACHE_KEY(id))),
        this.invalidateCaches()
      ])
      this.scheduleCacheWarm(user)

      this.syncBulkDeleteToDashboard(success.map(({ id }) => id)).catch(e =>
        this.logger.error(
          `[sync] bulk-delete dashboard failed: ${e?.message ?? e}`
        )
      )

      this.syncBulkDeleteToScraper(success.map(({ id }) => id)).catch(e =>
        this.logger.error(
          `[sync] bulk-delete scraper failed: ${e?.message ?? e}`
        )
      )
    }

    return {
      success,
      skipped,
      totalProcessed: ids.length,
      successCount: success.length,
      skippedCount: skipped.length
    }
  }

  private async fetchAllCachedPropertiesRaw(
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const cacheKey = `property:all:${user.id}`
    const cached =
      await this.redisService.get<PropertyWithRelations[]>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] property:fetchAllCachedPropertiesRaw — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] property:fetchAllCachedPropertiesRaw — fetching from MongoDB (key: ${cacheKey})`
    )

    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return []
    }

    const where = accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }
    const data = await this.repo.findAll({
      where,
      orderBy: { created_at: 'desc' }
    })

    const masked = data.map(p => this.maskCredentialsForResponse(p))
    await this.redisService.set(cacheKey, masked, CACHE_TTL_ALL)
    return masked
  }

  async findAllCachedForGlobalFilter(
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    return this.fetchAllCachedPropertiesRaw(user)
  }

  async findAllCached(
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const [data, columnList] = await Promise.all([
      this.fetchAllCachedPropertiesRaw(user),
      this.getRoleColumnList(user)
    ])

    const applyFilter = (p: PropertyWithRelations) =>
      columnList
        ? (applyColumnFilter(p, columnList) as PropertyWithRelations)
        : p

    if (data.length > 0) {
      this.logger.log(
        `[CACHE HIT] property:findAllCached — served from Redis (key: property:all:${user.id})`
      )
    }
    return data.map(applyFilter)
  }

  async refreshCache(user: IUserWithPermissions) {
    this.logger.log(
      `[MANUAL CACHE REFRESH] Clearing all cache keys (requested by user: ${user.id})`
    )

    await this.globalFilterCache.invalidateAllIncludingPropertyItems()

    this.logger.log(
      `[MANUAL CACHE REFRESH] Successfully cleared all property, portfolio, and subportfolio cache keys`
    )

    await this.warmGlobalFilterCaches(user)

    return {
      message:
        'Cache refreshed successfully. Global filter caches rebuilt for your account.'
    }
  }

  async getAllDataForGlobalFilter(user: IUserWithPermissions) {
    const cacheKey = GLOBAL_FILTER_KEY(user.id)
    const cached = await this.redisService.get<AllDataForGlobalFilterResponse>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] global-filter:getAllDataForGlobalFilter — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] global-filter:getAllDataForGlobalFilter — computing from source caches (key: ${cacheKey})`
    )

    const [portfolios, properties, subportfolios] = await Promise.all([
      this.portfolioService.findAllCached(user),
      this.findAllCachedForGlobalFilter(user),
      this.subportfolioService.findAllCachedForGlobalFilter(user)
    ])

    const uniqueExpediaPriorities = new Set<string>()
    const uniqueBookingPriorities = new Set<string>()
    const uniqueAgodaPriorities = new Set<string>()
    const uniqueExpediaServiceFees = new Set<string>()
    const priorityMap = new Map<string, Priority>()
    const uniqueFromDb = new Set<string>()
    const uniqueToDb = new Set<string>()
    const uniqueExpediaRevisedDates = new Set<string>()
    const uniqueExpediaSchedulerReviewFroms = new Set<string>()
    const uniqueExpediaSchedulerReviewTos = new Set<string>()
    const uniqueExpediaSchedulerReviewDbFroms = new Set<string>()
    const uniqueExpediaSchedulerReviewDbTos = new Set<string>()
    const uniqueExpediaSchedulerDbs = new Set<string>()
    const uniqueExpediaCrs = new Set<string>()
    const uniqueExpediaCrsDbs = new Set<string>()
    const uniqueExpediaRunDates = new Set<string>()
    const uniqueExpediaRunDateDbs = new Set<string>()
    const uniqueExpediaDbDurations = new Set<string>()
    const uniqueExpediaCredentialVerified = new Set<string>()
    const uniqueExpediaOtpNumbers = new Set<string>()
    const uniqueBookingServiceFees = new Set<string>()
    const uniqueBookingCrs = new Set<string>()
    const uniqueBookingRunDates = new Set<string>()
    const uniqueBookingRevisedDates = new Set<string>()
    const uniqueBookingCredentialVerified = new Set<string>()
    const uniqueBookingOtpNumbers = new Set<string>()
    const uniqueAgodaServiceFees = new Set<string>()
    const uniqueAgodaCrs = new Set<string>()
    const uniqueAgodaRunDates = new Set<string>()
    const uniqueAgodaRevisedDates = new Set<string>()
    const uniqueAgodaCredentialVerified = new Set<string>()
    const uniqueAgodaOtpNumbers = new Set<string>()
    const uniqueSalesReps = new Set<string>()
    const uniqueDiscontinuedEmailIds = new Set<string>()
    const uniqueCybersourceMids = new Set<string>()
    const uniqueAdyenLocations = new Set<string>()
    const uniqueStripeConnectedEmails = new Set<string>()
    const uniqueExpediaIds = new Set<string>()
    const portfolioMap = new Map<string, { id: string; name: string }>()
    const propertyMap = new Map<string, { id: string; name: string }>()
    const uniqueBookingIds = new Set<string>()
    const uniqueAgodaIds = new Set<string>()
    const uniqueHotelAddresses = new Set<string>()
    const uniqueCardDescriptors = new Set<string>()
    const uniqueNewDomainEmails = new Set<string>()
    const uniquePortfolioContactEmails = new Set<string>()
    const uniqueCaseContactEmails = new Set<string>()
    const uniqueCaseManagementContacts = new Set<string>()
    const uniqueAccessContacts = new Set<string>()
    const uniqueReportingContacts = new Set<string>()
    const expediaProcessorMap = new Map<string, any>()
    const bookingProcessorMap = new Map<string, any>()
    const agodaProcessorMap = new Map<string, any>()
    const uniqueFpMids = new Set<string>()
    const uniqueStripeAccountEmails = new Set<string>()
    const uniqueFromDates = new Set<string>()
    const uniqueToDates = new Set<string>()
    const uniquePropertyIdentifiers = new Set<string>()
    const uniquePortfolioContacts = new Set<string>()
    const uniqueFpUsernames = new Set<string>()
    const expediaBillingTypeMap = new Map<string, any>()
    const expediaServiceTypeMap = new Map<string, any>()
    const expediaFrequencyMap = new Map<string, any>()
    const uniqueExpediaFroms = new Set<string>()
    const uniqueExpediaTos = new Set<string>()
    const uniqueExpediaDurations = new Set<string>()
    const bookingBillingTypeMap = new Map<string, any>()
    const bookingServiceTypeMap = new Map<string, any>()
    const bookingFrequencyMap = new Map<string, any>()
    const uniqueBookingFroms = new Set<string>()
    const uniqueBookingTos = new Set<string>()
    const uniqueBookingDurations = new Set<string>()
    const agodaBillingTypeMap = new Map<string, any>()
    const agodaServiceTypeMap = new Map<string, any>()
    const agodaFrequencyMap = new Map<string, any>()
    const uniqueAgodaFroms = new Set<string>()
    const uniqueAgodaTos = new Set<string>()
    const uniqueAgodaDurations = new Set<string>()
    const portfolioIdSet = new Set<string>()
    const subportfolioMap = new Map<
      string,
      { id: string; name: string; portfolio_id: string }
    >()
    const serviceTypeMap = new Map<string, any>()
    const currencyMap = new Map<string, any>()
    const uniqueDescriptions = new Set<string>()
    const uniqueExpediaStatuses = new Set<string>()
    const uniqueBookingStatuses = new Set<string>()
    const uniqueAgodaStatuses = new Set<string>()
    const uniqueQpUsernames = new Set<string>()
    const uniquePreviousPortfolioIds = new Set<string>()
    const uniqueNextDueDates = new Set<string>()
    const uniqueExpediaAccessLevels = new Set<string>()
    const uniqueExpediaSchedulers = new Set<string>()
    const uniqueBookingAccessLevels = new Set<string>()
    const uniqueBookingSchedulers = new Set<string>()
    const uniqueAgodaAccessLevels = new Set<string>()
    const uniqueAgodaSchedulers = new Set<string>()
    const uniqueNeedAnotherDomain = new Set<string>()
    const uniqueBookingOtpPhone = new Set<string>()
    const uniqueExpediaSecondaryUsernames = new Set<string>()
    const uniqueBookingSecondaryUsernames = new Set<string>()
    const uniqueAgodaSecondaryUsernames = new Set<string>()
    const uniqueExpediaUsernames = new Set<string>()
    const uniqueBookingUsernames = new Set<string>()
    const uniqueAgodaUsernames = new Set<string>()

    portfolios.forEach((portfolio: any) => {
      if (portfolio.id && portfolio.name) {
        portfolioMap.set(portfolio.id, {
          id: portfolio.id,
          name: portfolio.name
        })
      }
      if (portfolio.contact_email)
        uniquePortfolioContactEmails.add(portfolio.contact_email)
      if (portfolio.portfolio_contact_email)
        uniquePortfolioContactEmails.add(portfolio.portfolio_contact_email)
    })

    subportfolios.forEach(subportfolio => {
      subportfolioMap.set(subportfolio.id, {
        id: subportfolio.id,
        name: subportfolio.name,
        portfolio_id: subportfolio.portfolio_id
      })
    })

    properties.forEach((property: any) => {
      if (property.portfolio_id) portfolioIdSet.add(property.portfolio_id)
      if (property.service_type)
        serviceTypeMap.set(property.service_type.id, property.service_type)
      if (property.currency)
        currencyMap.set(property.currency.id, property.currency)
      if (property.expedia_id) uniqueExpediaIds.add(property.expedia_id)
      if (property.booking_id) uniqueBookingIds.add(property.booking_id)
      if (property.agoda_id) uniqueAgodaIds.add(property.agoda_id)
      if (property.id && property.name) {
        propertyMap.set(property.id, { id: property.id, name: property.name })
      }
      if (property.hotel_address)
        uniqueHotelAddresses.add(property.hotel_address)
      if (property.card_descriptor)
        uniqueCardDescriptors.add(property.card_descriptor)
      if (property.new_domain_email)
        uniqueNewDomainEmails.add(property.new_domain_email)
      if (property.portfolio_contact_email)
        uniquePortfolioContactEmails.add(property.portfolio_contact_email)
      if (property.primary_case_email)
        uniqueCaseContactEmails.add(property.primary_case_email)
      if (property.case_management_contact)
        uniqueCaseManagementContacts.add(property.case_management_contact)
      if (property.access_contact)
        uniqueAccessContacts.add(property.access_contact)
      if (property.reporting_contact)
        uniqueReportingContacts.add(property.reporting_contact)
      if (property.description) uniqueDescriptions.add(property.description)
      if (property.expedia_status)
        uniqueExpediaStatuses.add(property.expedia_status)
      if (property.booking_status)
        uniqueBookingStatuses.add(property.booking_status)
      if (property.agoda_status) uniqueAgodaStatuses.add(property.agoda_status)
      if (property.qp_username) uniqueQpUsernames.add(property.qp_username)
      if (property.previous_portfolio_id)
        uniquePreviousPortfolioIds.add(property.previous_portfolio_id)
      if (property.next_due_date)
        uniqueNextDueDates.add(
          property.next_due_date instanceof Date
            ? property.next_due_date.toISOString()
            : String(property.next_due_date)
        )
      if (property.expedia_processor)
        expediaProcessorMap.set(
          property.expedia_processor.id,
          property.expedia_processor
        )
      if (property.booking_processor)
        bookingProcessorMap.set(
          property.booking_processor.id,
          property.booking_processor
        )
      if (property.agoda_processor)
        agodaProcessorMap.set(
          property.agoda_processor.id,
          property.agoda_processor
        )
      if (property.fp_mid) uniqueFpMids.add(property.fp_mid)
      if (property.stripe_account_email)
        uniqueStripeAccountEmails.add(property.stripe_account_email)
      if (property.from) uniqueFromDates.add(property.from)
      if (property.to) uniqueToDates.add(property.to)
      if (property.portfolio?.id && property.portfolio?.name) {
        portfolioMap.set(property.portfolio.id, {
          id: property.portfolio.id,
          name: property.portfolio.name
        })
      }
      if (property.subportfolio?.id && property.subportfolio?.name) {
        subportfolioMap.set(property.subportfolio.id, {
          id: property.subportfolio.id,
          name: property.subportfolio.name,
          portfolio_id:
            property.subportfolio.portfolio_id ?? property.portfolio_id ?? ''
        })
      }
      if (property.property_identifier)
        uniquePropertyIdentifiers.add(property.property_identifier)
      if (property.portfolio_contact)
        uniquePortfolioContacts.add(property.portfolio_contact)
      if (property.fp_username) uniqueFpUsernames.add(property.fp_username)
      if (property.expedia_billing_type)
        expediaBillingTypeMap.set(
          property.expedia_billing_type.id,
          property.expedia_billing_type
        )
      if (property.expedia_service_type)
        expediaServiceTypeMap.set(
          property.expedia_service_type.id,
          property.expedia_service_type
        )
      if (property.expedia_frequency)
        expediaFrequencyMap.set(
          property.expedia_frequency.id,
          property.expedia_frequency
        )
      if (property.expedia_from) uniqueExpediaFroms.add(property.expedia_from)
      if (property.expedia_to) uniqueExpediaTos.add(property.expedia_to)
      if (property.expedia_duration != null)
        uniqueExpediaDurations.add(String(property.expedia_duration))
      if (property.expedia_access_level != null)
        uniqueExpediaAccessLevels.add(String(property.expedia_access_level))
      if (property.expedia_scheduler != null)
        uniqueExpediaSchedulers.add(String(property.expedia_scheduler))
      if (property.booking_billing_type)
        bookingBillingTypeMap.set(
          property.booking_billing_type.id,
          property.booking_billing_type
        )
      if (property.booking_service_type)
        bookingServiceTypeMap.set(
          property.booking_service_type.id,
          property.booking_service_type
        )
      if (property.booking_frequency)
        bookingFrequencyMap.set(
          property.booking_frequency.id,
          property.booking_frequency
        )
      if (property.booking_from) uniqueBookingFroms.add(property.booking_from)
      if (property.booking_to) uniqueBookingTos.add(property.booking_to)
      if (property.booking_duration != null)
        uniqueBookingDurations.add(String(property.booking_duration))
      if (property.booking_access_level != null)
        uniqueBookingAccessLevels.add(String(property.booking_access_level))
      if (property.booking_scheduler != null)
        uniqueBookingSchedulers.add(String(property.booking_scheduler))
      if (property.agoda_billing_type)
        agodaBillingTypeMap.set(
          property.agoda_billing_type.id,
          property.agoda_billing_type
        )
      if (property.agoda_service_type)
        agodaServiceTypeMap.set(
          property.agoda_service_type.id,
          property.agoda_service_type
        )
      if (property.agoda_frequency)
        agodaFrequencyMap.set(
          property.agoda_frequency.id,
          property.agoda_frequency
        )
      if (property.agoda_from) uniqueAgodaFroms.add(property.agoda_from)
      if (property.agoda_to) uniqueAgodaTos.add(property.agoda_to)
      if (property.agoda_duration != null)
        uniqueAgodaDurations.add(String(property.agoda_duration))
      if (property.agoda_access_level != null)
        uniqueAgodaAccessLevels.add(String(property.agoda_access_level))
      if (property.agoda_scheduler != null)
        uniqueAgodaSchedulers.add(String(property.agoda_scheduler))
      if (property.need_another_domain != null)
        uniqueNeedAnotherDomain.add(String(property.need_another_domain))
      if (property.booking_otp_phone)
        uniqueBookingOtpPhone.add(property.booking_otp_phone)

      const cred =
        Array.isArray(property.credentials) && property.credentials.length > 0
          ? property.credentials[0]
          : null
      if (cred?.expediaSecondaryUsername)
        uniqueExpediaSecondaryUsernames.add(cred.expediaSecondaryUsername)
      if (cred?.bookingSecondaryUsername)
        uniqueBookingSecondaryUsernames.add(cred.bookingSecondaryUsername)
      if (cred?.agodaSecondaryUsername)
        uniqueAgodaSecondaryUsernames.add(cred.agodaSecondaryUsername)
      if (cred?.expediaUsername)
        uniqueExpediaUsernames.add(cred.expediaUsername)
      if (cred?.bookingUsername)
        uniqueBookingUsernames.add(cred.bookingUsername)
      if (cred?.agodaUsername)
        uniqueAgodaUsernames.add(cred.agodaUsername)
      if (property.expedia_service_fee)
        uniqueExpediaServiceFees.add(property.expedia_service_fee)
      if (property.priority)
        priorityMap.set(property.priority.id, property.priority)
      if (property.expedia_priority)
        uniqueExpediaPriorities.add(property.expedia_priority)
      if (property.booking_priority)
        uniqueBookingPriorities.add(property.booking_priority)
      if (property.agoda_priority)
        uniqueAgodaPriorities.add(property.agoda_priority)
      if (property.from_db) uniqueFromDb.add(property.from_db)
      if (property.to_db) uniqueToDb.add(property.to_db)
      if (property.expedia_revised_date)
        uniqueExpediaRevisedDates.add(property.expedia_revised_date)
      if (property.expedia_scheduler_review_from)
        uniqueExpediaSchedulerReviewFroms.add(
          property.expedia_scheduler_review_from
        )
      if (property.expedia_scheduler_review_to)
        uniqueExpediaSchedulerReviewTos.add(
          property.expedia_scheduler_review_to
        )
      if (property.expedia_scheduler_review_db_from)
        uniqueExpediaSchedulerReviewDbFroms.add(
          property.expedia_scheduler_review_db_from
        )
      if (property.expedia_scheduler_review_db_to)
        uniqueExpediaSchedulerReviewDbTos.add(
          property.expedia_scheduler_review_db_to
        )
      if (property.expedia_scheduler_db)
        uniqueExpediaSchedulerDbs.add(property.expedia_scheduler_db)
      if (property.expedia_crs) uniqueExpediaCrs.add(property.expedia_crs)
      if (property.expedia_crs_db)
        uniqueExpediaCrsDbs.add(property.expedia_crs_db)
      if (property.expedia_run_date)
        uniqueExpediaRunDates.add(property.expedia_run_date)
      if (property.expedia_run_date_db)
        uniqueExpediaRunDateDbs.add(property.expedia_run_date_db)
      if (property.expedia_db_duration != null)
        uniqueExpediaDbDurations.add(String(property.expedia_db_duration))
      if (property.expedia_credential_verified != null)
        uniqueExpediaCredentialVerified.add(
          String(property.expedia_credential_verified)
        )
      if (property.expedia_otp_number)
        uniqueExpediaOtpNumbers.add(property.expedia_otp_number)
      if (property.booking_service_fee != null)
        uniqueBookingServiceFees.add(String(property.booking_service_fee))
      if (property.booking_crs) uniqueBookingCrs.add(property.booking_crs)
      if (property.booking_run_date)
        uniqueBookingRunDates.add(property.booking_run_date)
      if (property.booking_revised_date)
        uniqueBookingRevisedDates.add(property.booking_revised_date)
      if (property.booking_credential_verified != null)
        uniqueBookingCredentialVerified.add(
          String(property.booking_credential_verified)
        )
      if (property.booking_otp_number)
        uniqueBookingOtpNumbers.add(property.booking_otp_number)
      if (property.agoda_service_fee != null)
        uniqueAgodaServiceFees.add(String(property.agoda_service_fee))
      if (property.agoda_crs) uniqueAgodaCrs.add(property.agoda_crs)
      if (property.agoda_run_date)
        uniqueAgodaRunDates.add(property.agoda_run_date)
      if (property.agoda_revised_date)
        uniqueAgodaRevisedDates.add(property.agoda_revised_date)
      if (property.agoda_credential_verified != null)
        uniqueAgodaCredentialVerified.add(
          String(property.agoda_credential_verified)
        )
      if (property.agoda_otp_number)
        uniqueAgodaOtpNumbers.add(property.agoda_otp_number)
      if (property.sales_rep)
        uniqueSalesReps.add(property.sales_rep)
      if (Array.isArray(property.discontinued_email_ids)) {
        property.discontinued_email_ids.forEach((e: string) => uniqueDiscontinuedEmailIds.add(e))
      }
      if (property.cybersource_mid)
        uniqueCybersourceMids.add(property.cybersource_mid)
      if (property.adyen_location)
        uniqueAdyenLocations.add(property.adyen_location)
      if (property.stripe_connected_email)
        uniqueStripeConnectedEmails.add(property.stripe_connected_email)
    })

    const result: AllDataForGlobalFilterResponse = {
      expedia_id: Array.from(uniqueExpediaIds).sort(),
      portfolio: Array.from(portfolioMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      property: Array.from(propertyMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      portfolio_id: Array.from(portfolioIdSet).sort(),
      subportfolio: Array.from(subportfolioMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      booking_id: Array.from(uniqueBookingIds).sort(),
      agoda_id: Array.from(uniqueAgodaIds).sort(),
      hotel_address: Array.from(uniqueHotelAddresses).sort(),
      card_descriptor: Array.from(uniqueCardDescriptors).sort(),
      new_domain_email: Array.from(uniqueNewDomainEmails).sort(),
      portfolio_contact_email: Array.from(uniquePortfolioContactEmails).sort(),
      case_contact_email: Array.from(uniqueCaseContactEmails).sort(),
      case_management_contact: Array.from(uniqueCaseManagementContacts).sort(),
      access_contact: Array.from(uniqueAccessContacts).sort(),
      reporting_contact: Array.from(uniqueReportingContacts).sort(),
      description: Array.from(uniqueDescriptions).sort(),
      expedia_status: Array.from(uniqueExpediaStatuses).sort(),
      booking_status: Array.from(uniqueBookingStatuses).sort(),
      agoda_status: Array.from(uniqueAgodaStatuses).sort(),
      expedia_processor: Array.from(expediaProcessorMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      booking_processor: Array.from(bookingProcessorMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      agoda_processor: Array.from(agodaProcessorMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      fp_mid: Array.from(uniqueFpMids).sort(),
      stripe_account_email: Array.from(uniqueStripeAccountEmails).sort(),
      from: Array.from(uniqueFromDates).sort(),
      to: Array.from(uniqueToDates).sort(),
      property_identifier: Array.from(uniquePropertyIdentifiers).sort(),
      portfolio_contact: Array.from(uniquePortfolioContacts).sort(),
      service_type: Array.from(serviceTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      currency: Array.from(currencyMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      fp_username: Array.from(uniqueFpUsernames).sort(),
      qp_username: Array.from(uniqueQpUsernames).sort(),
      previous_portfolio_id: Array.from(uniquePreviousPortfolioIds).sort(),
      next_due_date: Array.from(uniqueNextDueDates).sort(),
      expedia_billing_type: Array.from(expediaBillingTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      expedia_service_type: Array.from(expediaServiceTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      expedia_frequency: Array.from(expediaFrequencyMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      expedia_from: Array.from(uniqueExpediaFroms).sort(),
      expedia_to: Array.from(uniqueExpediaTos).sort(),
      expedia_duration: Array.from(uniqueExpediaDurations).sort(),
      expedia_access_level: Array.from(uniqueExpediaAccessLevels).sort(),
      expedia_scheduler: Array.from(uniqueExpediaSchedulers).sort(),
      booking_billing_type: Array.from(bookingBillingTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      booking_service_type: Array.from(bookingServiceTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      booking_frequency: Array.from(bookingFrequencyMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      booking_from: Array.from(uniqueBookingFroms).sort(),
      booking_to: Array.from(uniqueBookingTos).sort(),
      booking_duration: Array.from(uniqueBookingDurations).sort(),
      booking_access_level: Array.from(uniqueBookingAccessLevels).sort(),
      booking_scheduler: Array.from(uniqueBookingSchedulers).sort(),
      agoda_billing_type: Array.from(agodaBillingTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      agoda_service_type: Array.from(agodaServiceTypeMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      agoda_frequency: Array.from(agodaFrequencyMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      agoda_from: Array.from(uniqueAgodaFroms).sort(),
      agoda_to: Array.from(uniqueAgodaTos).sort(),
      agoda_duration: Array.from(uniqueAgodaDurations).sort(),
      agoda_access_level: Array.from(uniqueAgodaAccessLevels).sort(),
      agoda_scheduler: Array.from(uniqueAgodaSchedulers).sort(),
      need_another_domain: Array.from(uniqueNeedAnotherDomain).sort(),
      booking_otp_phone: Array.from(uniqueBookingOtpPhone).sort(),
      expedia_secondary_username: Array.from(
        uniqueExpediaSecondaryUsernames
      ).sort(),
      booking_secondary_username: Array.from(
        uniqueBookingSecondaryUsernames
      ).sort(),
      agoda_secondary_username: Array.from(
        uniqueAgodaSecondaryUsernames
      ).sort(),
      user_name_expedia: Array.from(uniqueExpediaUsernames).sort(),
      user_name_booking: Array.from(uniqueBookingUsernames).sort(),
      user_name_agoda: Array.from(uniqueAgodaUsernames).sort(),
      expedia_service_fee: Array.from(uniqueExpediaServiceFees).sort(),
      priority: Array.from(priorityMap.values()).sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ),
      expedia_priority: Array.from(uniqueExpediaPriorities).sort(),
      booking_priority: Array.from(uniqueBookingPriorities).sort(),
      agoda_priority: Array.from(uniqueAgodaPriorities).sort(),
      from_db: Array.from(uniqueFromDb).sort(),
      to_db: Array.from(uniqueToDb).sort(),
      expedia_revised_date: Array.from(uniqueExpediaRevisedDates).sort(),
      expedia_scheduler_review_from: Array.from(
        uniqueExpediaSchedulerReviewFroms
      ).sort(),
      expedia_scheduler_review_to: Array.from(
        uniqueExpediaSchedulerReviewTos
      ).sort(),
      expedia_scheduler_review_db_from: Array.from(
        uniqueExpediaSchedulerReviewDbFroms
      ).sort(),
      expedia_scheduler_review_db_to: Array.from(
        uniqueExpediaSchedulerReviewDbTos
      ).sort(),
      expedia_scheduler_db: Array.from(uniqueExpediaSchedulerDbs).sort(),
      expedia_crs: Array.from(uniqueExpediaCrs).sort(),
      expedia_crs_db: Array.from(uniqueExpediaCrsDbs).sort(),
      expedia_run_date: Array.from(uniqueExpediaRunDates).sort(),
      expedia_run_date_db: Array.from(uniqueExpediaRunDateDbs).sort(),
      expedia_db_duration: Array.from(uniqueExpediaDbDurations).sort(),
      expedia_credential_verified: Array.from(
        uniqueExpediaCredentialVerified
      ).sort(),
      expedia_otp_number: Array.from(uniqueExpediaOtpNumbers).sort(),
      booking_service_fee: Array.from(uniqueBookingServiceFees).sort(),
      booking_crs: Array.from(uniqueBookingCrs).sort(),
      booking_run_date: Array.from(uniqueBookingRunDates).sort(),
      booking_revised_date: Array.from(uniqueBookingRevisedDates).sort(),
      booking_credential_verified: Array.from(
        uniqueBookingCredentialVerified
      ).sort(),
      booking_otp_number: Array.from(uniqueBookingOtpNumbers).sort(),
      agoda_service_fee: Array.from(uniqueAgodaServiceFees).sort(),
      agoda_crs: Array.from(uniqueAgodaCrs).sort(),
      agoda_run_date: Array.from(uniqueAgodaRunDates).sort(),
      agoda_revised_date: Array.from(uniqueAgodaRevisedDates).sort(),
      agoda_credential_verified: Array.from(
        uniqueAgodaCredentialVerified
      ).sort(),
      agoda_otp_number: Array.from(uniqueAgodaOtpNumbers).sort(),
      sales_rep: Array.from(uniqueSalesReps).sort(),
      discontinued_email_ids: Array.from(uniqueDiscontinuedEmailIds).sort(),
      cybersource_mid: Array.from(uniqueCybersourceMids).sort(),
      adyen_location: Array.from(uniqueAdyenLocations).sort(),
      stripe_connected_email: Array.from(uniqueStripeConnectedEmails).sort(),
    } as AllDataForGlobalFilterResponse

    // Cache the aggregated result (same TTL as the property list cache)
    await this.redisService.set(cacheKey, result, CACHE_TTL_ALL)
    return result
  }

  private hashQuery(query: object): string {
    return createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16)
  }

  private async verifyUserCredentials(
    userName: string | undefined,
    userPassword: string | undefined,
    currentUser: IUserWithPermissions
  ): Promise<boolean> {
    // If no credentials provided, return false
    if (!userName || !userPassword) {
      return false
    }

    // Verify the provided credentials match the current authenticated user
    if (userName !== currentUser.email) {
      return false
    }

    // Get user from database with password
    const userFromDb = await this.authRepository.findUserByEmail(userName)
    if (!userFromDb) {
      return false
    }

    // Verify password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      userPassword,
      userFromDb.password
    )

    return isPasswordValid
  }

  private booleanValuesForInClause(
    values: (string | number | boolean)[]
  ): boolean[] {
    const set = new Set<boolean>()
    for (const v of values) {
      if (v === true || v === 'true' || v === '1' || v === 1) set.add(true)
      if (v === false || v === 'false' || v === '0' || v === 0) set.add(false)
    }
    return [...set]
  }

  private booleanFilterCondition(
    fieldName: string,
    values: (string | number | boolean)[]
  ): any {
    const bools = this.booleanValuesForInClause(values)

    // If no valid boolean values, return null (no filter)
    if (bools.length === 0) return null

    // If both true and false are present, no filter needed (matches all)
    if (bools.length === 2) return null

    if (bools.length === 1) {
      // For false filters on nullable boolean fields, treat null as false so
      // records that were never explicitly set are included in the result.
      if (bools[0] === false) {
        return {
          OR: [{ [fieldName]: { equals: false } }, { [fieldName]: null }]
        }
      }
      return { [fieldName]: { equals: true } }
    }

    return null
  }

  private intValuesForInClause(
    values: (string | number | boolean)[]
  ): number[] {
    const nums: number[] = []
    for (const v of values) {
      const n = Number(v)
      if (!Number.isNaN(n) && Number.isFinite(n)) nums.push(n)
    }
    return nums
  }

  private stringValuesForInClause(
    values: (string | number | boolean)[]
  ): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const v of values) {
      const s = String(v).trim()
      if (s && !seen.has(s)) {
        seen.add(s)
        out.push(s)
      }
    }
    return out
  }

  /** REGULAR / HIGH — normalized uppercase; filter is case-insensitive for legacy rows. */
  private otaPriorityFilterCondition(
    fieldName: string,
    values: (string | number | boolean)[]
  ): { OR: Record<string, unknown>[] } | null {
    const priorities = [
      ...new Set(
        values
          .map(v => String(v).trim().toUpperCase())
          .filter(Boolean)
      )
    ]
    if (priorities.length === 0) return null
    return {
      OR: priorities.map(v => ({
        [fieldName]: { equals: v, mode: 'insensitive' }
      }))
    }
  }

  private pickFields(src: any, fields: string[]) {
    const out: Record<string, any> = {}
    for (const f of fields) if (src?.[f] !== undefined) out[f] = src[f]
    return out
  }

  private decryptCredentialValue(val: string | null | undefined): string {
    if (!val) return ''
    try {
      return this.encryptionUtil.decrypt(val)
    } catch {
      return ''
    }
  }

  private async buildScraperBulkUpsertItem(
    property: PropertyWithRelations,
    row: number
  ): Promise<Record<string, unknown> | null> {
    if (!property.portfolio_id) return null

    const credentials = await this.credentialsService.findByPropertyId(
      property.id
    )

    return {
      row,
      parent_id: property.id,
      portfolio_parent_id: property.portfolio_id,
      name: property.name,
      ...(property.expedia_id != null
        ? { expedia_id: property.expedia_id }
        : {}),
      ...(property.booking_id != null
        ? { booking_id: property.booking_id }
        : {}),
      ...(property.agoda_id != null ? { agoda_id: property.agoda_id } : {}),
      ...(credentials?.expediaUsername
        ? { expedia_username: credentials.expediaUsername }
        : {}),
      ...(credentials?.expediaPassword
        ? {
            expedia_password: this.decryptCredentialValue(
              credentials.expediaPassword
            )
          }
        : {}),
      ...(credentials?.agodaUsername
        ? { agoda_username: credentials.agodaUsername }
        : {}),
      ...(credentials?.agodaPassword
        ? {
            agoda_password: this.decryptCredentialValue(
              credentials.agodaPassword
            )
          }
        : {}),
      ...(credentials?.bookingUsername
        ? { booking_username: credentials.bookingUsername }
        : {}),
      ...(credentials?.bookingPassword
        ? {
            booking_password: this.decryptCredentialValue(
              credentials.bookingPassword
            )
          }
        : {})
    }
  }

  private resolveParserBulkUpsertResult(
    parentId: string,
    bulkResult: {
      errors?: Array<{ parent_id: string; error: string }>
      successfulUpserts?: Array<{ parent_id: string; action: string }>
    } | null,
    hasPortfolio: boolean
  ): { success: boolean; reason?: string } {
    if (!hasPortfolio) {
      return {
        success: false,
        reason: 'Property has no portfolio_id — cannot sync to scraper'
      }
    }
    if (!this.scraperJwtClient) {
      return {
        success: false,
        reason:
          'Scraper JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      }
    }
    if (!bulkResult) {
      return {
        success: false,
        reason: 'Scraper bulk upsert was not attempted or failed entirely'
      }
    }

    const rowError = bulkResult.errors?.find(e => e.parent_id === parentId)
    if (rowError) {
      return { success: false, reason: rowError.error }
    }

    if (bulkResult.successfulUpserts?.some(u => u.parent_id === parentId)) {
      return { success: true }
    }

    return {
      success: false,
      reason: 'Property was not reported in scraper bulk upsert response'
    }
  }

  private async syncBulkUpsertToScraper(
    items: Record<string, unknown>[]
  ): Promise<{
    totalRows: number
    createdCount: number
    updatedCount: number
    failureCount: number
    errors: Array<{ row: number; parent_id: string; error: string }>
    successfulUpserts: Array<{
      parent_id: string
      action: 'created' | 'updated'
    }>
  } | null> {
    if (!items.length) return null

    if (!this.scraperJwtClient) {
      this.logger.warn(
        '[sync] scraper JWT client disabled, skipping property sync-bulk-upsert'
      )
      return null
    }

    try {
      const r = await this.scraperJwtClient.post(
        '/properties/sync-bulk-upsert',
        items,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      const data = r.data?.data ?? r.data
      this.logger.log(
        `[sync] scraper property sync-bulk-upsert: ${JSON.stringify(data)}`
      )
      return data
    } catch (e: any) {
      this.logger.error(
        `[sync] scraper property sync-bulk-upsert failed: ${e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? e)}`
      )
      return null
    }
  }

  private async syncUpsertPropertyToScraper(
    property: PropertyWithRelations
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.scraperJwtClient) {
      const reason =
        'Scraper JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }

    if (!property.portfolio_id) {
      const reason = 'Property has no portfolio_id — cannot sync to scraper'
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }

    const credentials = await this.credentialsService.findByPropertyId(
      property.id
    )

    const safeDecrypt = (val: string | null | undefined): string => {
      if (!val) return ''
      try {
        return this.encryptionUtil.decrypt(val)
      } catch {
        return ''
      }
    }

    const payload = {
      name: property.name,
      portfolio_parent_id: property.portfolio_id,
      ...(property.expedia_id != null
        ? { expedia_id: property.expedia_id }
        : {}),
      ...(property.booking_id != null
        ? { booking_id: property.booking_id }
        : {}),
      ...(property.agoda_id != null ? { agoda_id: property.agoda_id } : {}),
      ...(credentials?.expediaUsername
        ? { expedia_username: credentials.expediaUsername }
        : {}),
      ...(credentials?.expediaPassword
        ? { expedia_password: safeDecrypt(credentials.expediaPassword) }
        : {}),
      ...(credentials?.agodaUsername
        ? { agoda_username: credentials.agodaUsername }
        : {}),
      ...(credentials?.agodaPassword
        ? { agoda_password: safeDecrypt(credentials.agodaPassword) }
        : {}),
      ...(credentials?.bookingUsername
        ? { booking_username: credentials.bookingUsername }
        : {}),
      ...(credentials?.bookingPassword
        ? { booking_password: safeDecrypt(credentials.bookingPassword) }
        : {})
    }

    try {
      const r = await this.scraperJwtClient.post(
        `/properties/sync-upsert/${property.id}`,
        payload,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(
        `[sync] scraper property upsert: ${JSON.stringify(r.data)}`
      )
      return { success: true }
    } catch (e: any) {
      const reason = this.extractSyncErrorReason(e)
      this.logger.error(`[sync] scraper property upsert failed: ${reason}`)
      return { success: false, reason }
    }
  }

  private async syncDeletePropertyToScraper(parentId: string): Promise<void> {
    if (!this.scraperJwtClient) {
      this.logger.warn(
        '[sync] scraper JWT client disabled, skipping property delete sync'
      )
      return
    }

    try {
      const r = await this.scraperJwtClient.post(
        `/properties/sync-delete/${parentId}`,
        {},
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(
        `[sync] scraper property delete: ${JSON.stringify(r.data)}`
      )
    } catch (e: any) {
      this.logger.error(
        `[sync] scraper property delete failed: ${e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? e)}`
      )
    }
  }

  private async syncBulkDeleteToScraper(parentIds: string[]): Promise<void> {
    if (!parentIds.length) return

    if (!this.scraperJwtClient) {
      this.logger.warn(
        '[sync] scraper JWT client disabled, skipping property sync-bulk-delete'
      )
      return
    }

    const body = { items: parentIds.map(parent_id => ({ parent_id })) }

    try {
      const r = await this.scraperJwtClient.post(
        '/properties/sync-bulk-delete',
        body,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(
        `[sync] scraper property sync-bulk-delete: ${JSON.stringify(r.data)}`
      )
    } catch (e: any) {
      this.logger.error(
        `[sync] scraper property sync-bulk-delete failed: ${e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? e)}`
      )
    }
  }

  /** Extracts a concise, human-readable reason from an axios error.
   *  NestJS validation errors come back as { message: string[] }.
   *  Falls back to the plain error message string. */
  private extractSyncErrorReason(e: any): string {
    const data = e?.response?.data
    if (data) {
      const msgs: string[] = Array.isArray(data.message)
        ? data.message
        : typeof data.message === 'string'
          ? [data.message]
          : []
      if (msgs.length) return msgs.join(', ')
      if (typeof data.error === 'string') return data.error
      if (typeof data === 'string') return data
    }
    return e?.message ?? String(e)
  }

  private readonly inboundSyncFields = [
    'name',
    'card_descriptor',
    'is_active',
    'next_due_date',
    'expedia_id',
    'expedia_status',
    'booking_id',
    'booking_status',
    'agoda_id',
    'agoda_status'
  ]

  async syncByOta(dto: SyncByOtaDto) {
    if (
      dto.expedia_id == null &&
      dto.booking_id == null &&
      dto.agoda_id == null
    )
      return { status: 'no_ota_ids' }
    const ids = await this.repo.findIdsByOtaIds(dto)
    if (!ids.length) return { status: 'not_found' }
    if (ids.length > 1) {
      this.logger.warn(`[sync] ambiguous: ${ids.join(',')}`)
      return { status: 'ambiguous', candidates: ids }
    }

    const patch: Record<string, any> = {}
    for (const k of this.inboundSyncFields)
      if (dto.data?.[k] !== undefined) patch[k] = dto.data[k]
    if (!Object.keys(patch).length) return { status: 'no_op', id: ids[0] }

    const updated = await this.repo.update(ids[0], patch as UpdatePropertyDto)
    await Promise.all([
      this.redisService.del(CACHE_KEY(updated.id)),
      this.invalidateCaches()
    ])
    return { status: 'updated', id: updated.id }
  }

  private async syncBulkDeleteToDashboard(parentIds: string[]): Promise<void> {
    if (!parentIds.length) return

    if (!this.dashboardJwtClient) {
      this.logger.warn(
        '[sync] dashboard JWT client disabled, skipping property sync-bulk-delete'
      )
      return
    }

    const body = { items: parentIds.map(parent_id => ({ parent_id })) }

    try {
      const r = await this.dashboardJwtClient.post(
        '/api/property/sync-bulk-delete',
        body,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(
        `[sync] dashboard property sync-bulk-delete: ${JSON.stringify(r.data)}`
      )
    } catch (e: any) {
      this.logger.error(
        `[sync] dashboard property sync-bulk-delete failed: ${e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? e)}`
      )
    }
  }

  private async syncUpsertPropertyToDashboard(
    property: PropertyWithRelations
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.dashboardJwtClient) {
      const reason =
        'Dashboard JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }

    const credentials = await this.credentialsService.findByPropertyId(
      property.id
    )

    const safeDecrypt = (val: string | null | undefined): string => {
      if (!val) return ''
      try {
        return this.encryptionUtil.decrypt(val)
      } catch {
        return ''
      }
    }

    const currencyCode = property.currency?.code ?? 'USD'
    const currencyName = property.currency?.name ?? 'USD'

    const payload = {
      name: property.name,
      address: property.hotel_address || 'N/A',
      is_active: property.is_active,
      currency: {
        code: currencyCode,
        name: currencyName,
        symbol: ''
      },
      card_descriptor: property.card_descriptor ?? '',
      portfolio_parent_id: property.portfolio_id,
      credentials: {
        expedia_id: property.expedia_id?.toString() ?? '',
        expedia_username: credentials?.expediaUsername ?? '',
        expedia_password: safeDecrypt(credentials?.expediaPassword),
        agoda_id: property.agoda_id?.toString() ?? '',
        agoda_username: credentials?.agodaUsername ?? '',
        agoda_password: safeDecrypt(credentials?.agodaPassword),
        booking_id: property.booking_id?.toString() ?? '',
        booking_username: credentials?.bookingUsername ?? '',
        booking_password: safeDecrypt(credentials?.bookingPassword)
      }
    }

    try {
      const r = await this.dashboardJwtClient.post(
        `/api/property/sync-upsert/${property.id}`,
        payload,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(
        `[sync] dashboard property upsert: ${JSON.stringify(r.data)}`
      )
      return { success: true }
    } catch (e: any) {
      const reason = this.extractSyncErrorReason(e)
      this.logger.error(`[sync] dashboard property upsert failed: ${reason}`)
      return { success: false, reason }
    }
  }
}
