import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import type { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EmailUtil } from '../../common/utils/email.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IAuthRepository } from '../auth/auth.interface'
import type { IPortfolioService } from '../portfolio/portfolio.interface'
import type { ISubportfolioService } from '../subportfolio/subportfolio.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsService } from '../property-credentials/property-credentials.interface'
import { RedisService } from '../redis/redis.service'
import {
  BulkUpdateResultDto,
  CreatePropertyDto,
  ExportPropertyExcelDto,
  GetPropertyCredentialDto,
  PropertyFilterDto,
  RequiredFieldType,
  SyncByOtaDto,
  UpdatePropertyDto
} from './property.dto'
import type { SyncBulkUpsertRowResult } from './property.dto'
import {
  collectPropertyUniqueConflicts,
  normalizePropertyIdentifier,
  propertyIdentifierKey
} from './property-uniqueness.util'
import { mapPropertyToExcelRow, writePropertyExportBuffer } from '../../common/utils/property-excel.util'
import type { Priority } from '@prisma/client'
import type {
  ImportPropertiesResult,
  ImportPropertyRow,
  IPropertyRepository,
  IPropertyService,
  PropertyContact,
  PropertyWithRelations
} from './property.interface'
import axios, { AxiosInstance } from 'axios'
import { ConfigService } from '@nestjs/config'
import type { Configuration } from '../../config/configuration'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'

const CACHE_TTL_ITEM = 5 * 60 * 1000 // 5 minutes for individual records
const CACHE_TTL_ALL = 60 * 60 * 1000 // 1 hour for all properties cache
const CACHE_KEY = (id: string) => `property:${id}`
const ALL_PATTERN = 'property:all:*'

@Injectable()
export class PropertyService implements IPropertyService {
  private readonly logger = new Logger(PropertyService.name)
  private readonly dashboardClient: AxiosInstance | null
  private readonly dashboardJwtClient: AxiosInstance | null
  private readonly scraperClient: AxiosInstance | null

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
    private readonly syncCommunication: SyncCommunicationService
  ) {
    const timeout = this.config.get('syncTimeoutMs', { infer: true }) ?? 15000
    const dashUrl = this.config.get('dashboardBackendUrl', { infer: true }) ?? ''
    const dashTok = this.config.get('dashboardServiceToken', { infer: true }) ?? ''
    const scrUrl  = this.config.get('scraperBackendUrl', { infer: true }) ?? ''
    const scrTok  = this.config.get('scraperServiceToken', { infer: true }) ?? ''
    this.dashboardClient = dashUrl && dashTok
      ? axios.create({ baseURL: dashUrl, timeout, headers: { 'X-Service-Token': dashTok } })
      : null
    this.dashboardJwtClient = dashUrl && this.syncCommunication.isConfigured()
      ? axios.create({ baseURL: dashUrl, timeout })
      : null
    this.scraperClient = scrUrl && scrTok
      ? axios.create({ baseURL: scrUrl, timeout, headers: { 'X-Service-Token': scrTok } })
      : null
    if (!this.dashboardClient) this.logger.warn('[sync] dashboard disabled — URL/token missing')
    if (!this.dashboardJwtClient) this.logger.warn('[sync] dashboard JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing')
    if (!this.scraperClient)  this.logger.warn('[sync] scraper disabled — URL/token missing')
  }

  async create(
    data: CreatePropertyDto,
    _user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const normalizedIdentifier = normalizePropertyIdentifier(data.property_identifier)
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

    await this.redisService.deleteByPattern(ALL_PATTERN)
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
      this.fanOutPropertyCreate({
        name:               property.name,
        portfolio_name:     property.portfolio?.name ?? null,
        sub_portfolio_name: property.subportfolio?.name ?? null,
        expedia_id:         property.expedia_id ?? null,
        expedia_status:     property.expedia_status ?? null,
        booking_id:         property.booking_id ?? null,
        booking_status:     property.booking_status ?? null,
        agoda_id:           property.agoda_id ?? null,
        agoda_status:       property.agoda_status ?? null,
      }).catch(e => ({ success: false, reason: e?.message ?? String(e) }))
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
      .catch(e => this.logger.error(`[email] sync result email failed: ${e?.message ?? e}`))

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
              AND: [
                { from_db: { lte: toDate } },
                { to_db:   { gte: fromDate } }
              ]
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

        const applySingleFieldRange = (
          columnName: string,
          fromName: string,
          toName: string
        ) => {
          const fromF = filterMap.get(fromName)
          const toF   = filterMap.get(toName)
          const fromVal = fromF?.in?.[0] != null ? String(fromF.in[0]) : undefined
          const toVal   = toF?.in?.[0]   != null ? String(toF.in[0])   : undefined
          if (fromVal === undefined && toVal === undefined) return false
        
          const range: Record<string, string> = {}
          if (fromVal !== undefined) range.gte = fromVal
          if (toVal   !== undefined) range.lte = toVal
          whereConditions.push({ [columnName]: range })
          processedFilters.add(fromName)
          processedFilters.add(toName)
          return true
        }

        if (name === 'expedia_scheduler_review_from' || name === 'expedia_scheduler_review_to') {
          if (!processedFilters.has(name)) {
            applySingleFieldRange('expedia_scheduler_review',
              'expedia_scheduler_review_from', 'expedia_scheduler_review_to')
          }
          continue
        }
        if (name === 'expedia_scheduler_review_db_from' || name === 'expedia_scheduler_review_db_to') {
          if (!processedFilters.has(name)) {
            applySingleFieldRange('expedia_scheduler_review_db',
              'expedia_scheduler_review_db_from', 'expedia_scheduler_review_db_to')
          }
          continue
        }
        if (name === 'expedia_run_date_from' || name === 'expedia_run_date_to') {
          if (!processedFilters.has(name)) {
            applySingleFieldRange('expedia_run_date',
              'expedia_run_date_from', 'expedia_run_date_to')
          }
          continue
        }
        if (name === 'expedia_run_date_db_from' || name === 'expedia_run_date_db_to') {
          if (!processedFilters.has(name)) {
            applySingleFieldRange('expedia_run_date_db',
              'expedia_run_date_db_from', 'expedia_run_date_db_to')
          }
          continue
        }
        if (name === 'expedia_revised_date_from' || name === 'expedia_revised_date_to') {
          if (!processedFilters.has(name)) {
            applySingleFieldRange('expedia_revised_date',
              'expedia_revised_date_from', 'expedia_revised_date_to')
          }
          continue
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
            const numericValues = values.map(v => {
              const num = Number(v)
              return isNaN(num) ? null : num
            }).filter(v => v !== null)
            if (numericValues.length > 0) {
              whereConditions.push({ expedia_id: { in: numericValues } })
            }
            break
          }
          case 'booking_id': {
            // Convert to numbers as booking_id is Int in Prisma schema
            const numericValues = values.map(v => {
              const num = Number(v)
              return isNaN(num) ? null : num
            }).filter(v => v !== null)
            if (numericValues.length > 0) {
              whereConditions.push({ booking_id: { in: numericValues } })
            }
            break
          }
          case 'agoda_id': {
            // Convert to numbers as agoda_id is Int in Prisma schema
            const numericValues = values.map(v => {
              const num = Number(v)
              return isNaN(num) ? null : num
            }).filter(v => v !== null)
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
            const condition = this.booleanFilterCondition('expedia_access_level', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_scheduler': {
            const condition = this.booleanFilterCondition('expedia_scheduler', values)
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
            const condition = this.booleanFilterCondition('booking_access_level', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'booking_scheduler': {
            const condition = this.booleanFilterCondition('booking_scheduler', values)
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
            const condition = this.booleanFilterCondition('agoda_access_level', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_scheduler': {
            const condition = this.booleanFilterCondition('agoda_scheduler', values)
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
            const condition = this.booleanFilterCondition('need_another_domain', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'expedia_service_fee':
            whereConditions.push({ expedia_service_fee: { in: values } })
            break
          case 'expedia_priority_id':
            whereConditions.push({ expedia_priority_id: { in: values } })
            break
          case 'booking_priority_id':
            whereConditions.push({ booking_priority_id: { in: values } })
            break
          case 'agoda_priority_id':
            whereConditions.push({ agoda_priority_id: { in: values } })
            break
          case 'expedia_crs':
            whereConditions.push({ expedia_crs: { in: values } })
            break
          case 'expedia_crs_db':
            whereConditions.push({ expedia_crs_db: { in: values } })
            break
          case 'expedia_db_duration': {
            const nums = this.intValuesForInClause(values)
            if (nums.length) whereConditions.push({ expedia_db_duration: { in: nums } })
            break
          }
          case 'expedia_credential_verified': {
            const condition = this.booleanFilterCondition('expedia_credential_verified', values)
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
            const condition = this.booleanFilterCondition('booking_credential_verified', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'agoda_service_fee':
            whereConditions.push({ agoda_service_fee: { in: values } })
            break
          case 'agoda_credential_verified': {
            const condition = this.booleanFilterCondition('agoda_credential_verified', values)
            if (condition) whereConditions.push(condition)
            break
          }
          case 'sales_rep':
            whereConditions.push({ sales_rep: { in: values } })
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
          { hotel_address: { contains: filterDto.search, mode: 'insensitive' } },
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

    const [data, total] = await Promise.all([
      this.repo.findAll({ where, skip, take, orderBy }),
      this.repo.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? filterDto.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

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
        this.logger.warn(`Failed credential verification for user: ${user.email}`)
        const dataWithMaskedCredentials = data.map(p =>
          this.maskCredentialsForResponse(p)
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

      this.logger.debug('Credentials verified successfully, returning decrypted data')
      const dataWithDecryptedCredentials = data.map(p =>
        this.decryptCredentialsForResponse(p)
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
      this.maskCredentialsForResponse(p)
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
        if (cred.agodaSecondaryPassword)
          masked.agodaSecondaryPassword = MASK
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
    return property
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

    return {
      case_management_contact: property.case_management_contact,
      access_contact: property.access_contact,
      reporting_contact: property.reporting_contact,
      portfolio_contact_email: property.portfolio_contact_email,
      portfolio_contact: property.portfolio_contact
    }
  }

  async getContactExternal(id: string): Promise<PropertyContact> {
    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')

    return {
      case_management_contact: property.case_management_contact,
      access_contact: property.access_contact,
      reporting_contact: property.reporting_contact,
      portfolio_contact_email: property.portfolio_contact_email,
      portfolio_contact: property.portfolio_contact
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
        ? normalizePropertyIdentifier(data.property_identifier) ?? null
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
    if (data.expedia_id !== undefined) fieldsToCheck.expedia_id = data.expedia_id
    if (data.booking_id !== undefined) fieldsToCheck.booking_id = data.booking_id
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
      this.redisService.deleteByPattern(ALL_PATTERN)
    ])
    return this.repo.findById(id) as Promise<PropertyWithRelations>
  }

  async updateAndSync(id: string, data: UpdatePropertyDto, user: IUserWithPermissions) {
    const before = await this.repo.findById(id)
    if (!before) throw new NotFoundException('Property not found')
    const updated = await this.update(id, data, user)

    const [dashboardResult, parserResult] = await Promise.all([
      this.syncUpsertPropertyToDashboard(updated).catch(e => ({
        success: false,
        reason: e?.message ?? String(e)
      })),
      this.fanOutPropertyUpdate(
        {
          expedia_id: before.expedia_id ?? null,
          booking_id: before.booking_id ?? null,
          agoda_id:   before.agoda_id ?? null
        },
        data
      ).catch(e => ({ success: false, reason: e?.message ?? String(e) }))
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
      .catch(e => this.logger.error(`[email] sync result email failed: ${e?.message ?? e}`))

    return updated
  }
  
  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.redisService.deleteByPattern(ALL_PATTERN)
    ])
    try {
      if (this.dashboardJwtClient) {
        const r = await this.dashboardJwtClient.post(
          `/api/property/sync-delete/${id}`,
          {},
          { headers: this.syncCommunication.createAuthHeaders() }
        )
        this.logger.log(`[sync] dashboard property sync-delete: ${JSON.stringify(r.data)}`)
      } else {
        this.logger.warn('[sync] dashboard JWT client disabled, skipping property sync-delete')
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
        await this.fanOutPropertyDelete({
          expedia_id: before.expedia_id ?? null,
          booking_id: before.booking_id ?? null,
          agoda_id:   before.agoda_id   ?? null,
        })
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

    const isPasswordValid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!isPasswordValid) throw new BadRequestException('Invalid password')

    const property = await this.findOne(id, user)
    if (property.portfolio_id === portfolioId) throw new BadRequestException('Property is already in the specified portfolio')

    await this.repo.update(id, { portfolio_id: portfolioId })
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.redisService.deleteByPattern(ALL_PATTERN)
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

    const isPasswordValid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!isPasswordValid) throw new BadRequestException('Invalid password')

    this.logger.log(`User ${user.email} attempting bulk transfer of ${ids.length} properties to portfolio ${portfolioId}`)

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
          skipped.push({ id, name: property.name, reason: 'Property is already in the specified portfolio' })
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
      await this.redisService.deleteByPattern(ALL_PATTERN)
    }

    this.logger.log(`Bulk transfer completed: ${success.length} success, ${skipped.length} skipped`)

    return { success, skipped, successCount: success.length, skippedCount: skipped.length }
  }

  async findByPortfolioId(
    portfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    const list = await this.repo.findByPortfolioId(portfolioId)
    if (accessibleIds === 'all') return list
    const idSet = new Set(accessibleIds)
    return list.filter(p => idSet.has(p.id))
  }

  async findBySubportfolioId(
    subportfolioId: string,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    const list = await this.repo.findBySubportfolioId(subportfolioId)
    if (accessibleIds === 'all') return list
    const idSet = new Set(accessibleIds)
    return list.filter(p => idSet.has(p.id))
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
    const filterDto: PropertyFilterDto = { ...dto, page: undefined, limit: undefined }
    const filtered = await this.findAllWithFilters(filterDto, user)
    const filteredData = filtered.data as any[]

    if (filteredData.length === 0) {
      return { message: 'No properties matched the given filters. Email not sent.' }
    }

    // Step 2 — re-fetch the same properties directly from the repo (bypassing the
    // masking layer), then decrypt every credential field explicitly.
    const ids = filteredData.map((p: any) => p.id)
    const raw = await this.repo.findAll({ where: { id: { in: ids } }, orderBy: { created_at: 'desc' } })
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
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    )

    return { message: `Excel report with ${properties.length} record(s) sent to ${user.email}` }
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
    _user: IUserWithPermissions
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
    const headers = Object.keys(rawRows[0]).map(h => h.replace(/\s*\*+\s*$/, '').trim())

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
          if (str === 'true' || str === '1' || str === 'yes' || str === 'y' || str === 'verified') return 'true'
          if (str === 'false' || str === '0' || str === 'no' || str === 'n' || str === 'not verified' || str === 'access lost') return 'false'
          return undefined
        }

        const parseEnum = (val: any) => {
          if (!val) return undefined
          return String(val).trim().toUpperCase()
        }

        return {
          propertyName,
          portfolioName,
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
          agodaSecondaryPassword: encryptPassword(r['Agoda Secondary Password']),
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
            ? String(r['Expedia Service Type']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          expediaFrequency: r['Expedia Frequency']
            ? String(r['Expedia Frequency']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          expediaAccessLevel: parseBool(r['Expedia Access Level']),
          expediaFrom: r['Expedia From']
            ? String(r['Expedia From']).trim()
            : undefined,
          expediaTo: r['Expedia To']
            ? String(r['Expedia To']).trim()
            : undefined,
          expediaScheduler: parseBool(r['Expedia Scheduler']),
          expediaDuration: r['Expedia Duration']
            ? String(r['Expedia Duration']).trim()
            : undefined,
          bookingBillingType: parseEnum(r['Booking Billing Type']),
          bookingServiceType: r['Booking Service Type']
            ? String(r['Booking Service Type']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          bookingFrequency: r['Booking Frequency']
            ? String(r['Booking Frequency']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          bookingAccessLevel: parseBool(r['Booking Access Level']),
          bookingFrom: r['Booking From']
            ? String(r['Booking From']).trim()
            : undefined,
          bookingTo: r['Booking To']
            ? String(r['Booking To']).trim()
            : undefined,
          bookingScheduler: parseBool(r['Booking Scheduler']),
          bookingDuration: r['Booking Duration']
            ? String(r['Booking Duration']).trim()
            : undefined,
          agodaBillingType: parseEnum(r['Agoda Billing Type']),
          agodaServiceType: r['Agoda Service Type']
            ? String(r['Agoda Service Type']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          agodaFrequency: r['Agoda Frequency']
            ? String(r['Agoda Frequency']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          agodaAccessLevel: parseBool(r['Agoda Access Level']),
          agodaFrom: r['Agoda From']
            ? String(r['Agoda From']).trim()
            : undefined,
          agodaTo: r['Agoda To']
            ? String(r['Agoda To']).trim()
            : undefined,
          agodaScheduler: parseBool(r['Agoda Scheduler']),
          agodaDuration: r['Agoda Duration']
            ? String(r['Agoda Duration']).trim()
            : undefined,
          needAnotherDomain: parseBool(r['Need Another Domain']),
          bookingOtpPhone: r['Booking OTP Phone']
            ? String(r['Booking OTP Phone']).trim()
            : undefined,
          serviceTypeName: r['Service Type']
            ? String(r['Service Type']).trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')
            : undefined,
          currency: r['Currency']
            ? String(r['Currency']).trim()
            : undefined,
          // New Expedia fields
          expediaServiceFee: r['Expedia Service Fee'] ? String(r['Expedia Service Fee']).trim() : undefined,
          expediaPriority: r['Expedia Priority'] ? String(r['Expedia Priority']).trim() : undefined,
          expediaCrs: r['Expedia CRS'] ? String(r['Expedia CRS']).trim() : undefined,
          expediaCrsDb: r['Expedia CRS DB'] ? String(r['Expedia CRS DB']).trim() : undefined,
          expediaRunDateFrom: r['Expedia Run Date From'] ? String(r['Expedia Run Date From']).trim() : undefined,
          expediaRunDateTo: r['Expedia Run Date To'] ? String(r['Expedia Run Date To']).trim() : undefined,
          expediaRunDateDbFrom: r['Expedia Run Date DB From'] ? String(r['Expedia Run Date DB From']).trim() : undefined,
          expediaRunDateDbTo: r['Expedia Run Date DB To'] ? String(r['Expedia Run Date DB To']).trim() : undefined,
          expediaRevisedDate: r['Expedia Revised Date'] ? String(r['Expedia Revised Date']).trim() : undefined,
          expediaSchedulerReviewFrom: r['Expedia Scheduler Review From'] ? String(r['Expedia Scheduler Review From']).trim() : undefined,
          expediaSchedulerReviewTo: r['Expedia Scheduler Review To'] ? String(r['Expedia Scheduler Review To']).trim() : undefined,
          expediaSchedulerDb: r['Expedia Scheduler DB'] ? String(r['Expedia Scheduler DB']).trim() : undefined,
          expediaSchedulerReviewDbFrom: r['Expedia Scheduler Review DB From'] ? String(r['Expedia Scheduler Review DB From']).trim() : undefined,
          expediaSchedulerReviewDbTo: r['Expedia Scheduler Review DB To'] ? String(r['Expedia Scheduler Review DB To']).trim() : undefined,
          expediaDbDuration: r['Expedia DB Duration'] ? String(r['Expedia DB Duration']).trim() : undefined,
          expediaCredentialVerified: parseBool(r['Expedia Credential Verified']),
          expediaOtpNumber: r['Expedia OTP Number'] ? String(r['Expedia OTP Number']).trim() : undefined,
          fromDb: r['From DB'] ? String(r['From DB']).trim() : undefined,
          toDb: r['To DB'] ? String(r['To DB']).trim() : undefined,
          // New Booking fields
          bookingServiceFee: r['Booking Service Fee'] ? String(r['Booking Service Fee']).trim() : undefined,
          bookingPriority: r['Booking Priority'] ? String(r['Booking Priority']).trim() : undefined,
          bookingCrs: r['Booking CRS'] ? String(r['Booking CRS']).trim() : undefined,
          bookingRunDate: r['Booking Run Date'] ? String(r['Booking Run Date']).trim() : undefined,
          bookingRevisedDate: r['Booking Revised Date'] ? String(r['Booking Revised Date']).trim() : undefined,
          bookingCredentialVerified: parseBool(r['Booking Credential Verified']),
          bookingOtpNumber: r['Booking OTP Number'] ? String(r['Booking OTP Number']).trim() : undefined,
          // New Agoda fields
          agodaServiceFee: r['Agoda Service Fee'] ? String(r['Agoda Service Fee']).trim() : undefined,
          agodaPriority: r['Agoda Priority'] ? String(r['Agoda Priority']).trim() : undefined,
          agodaCrs: r['Agoda CRS'] ? String(r['Agoda CRS']).trim() : undefined,
          agodaRunDate: r['Agoda Run Date'] ? String(r['Agoda Run Date']).trim() : undefined,
          agodaRevisedDate: r['Agoda Revised Date'] ? String(r['Agoda Revised Date']).trim() : undefined,
          agodaCredentialVerified: parseBool(r['Agoda Credential Verified']),
          agodaOtpNumber: r['Agoda OTP Number'] ? String(r['Agoda OTP Number']).trim() : undefined,
          // Misc
          salesRep: r['Sales Rep'] ? String(r['Sales Rep']).trim() : undefined
        } satisfies ImportPropertyRow
      })
      .filter(Boolean) as ImportPropertyRow[]

    const result = await this.repo.importProperties(rows)
    await this.redisService.deleteByPattern(ALL_PATTERN)
    return result
  }
  
  async importFromExcelAndSync(file: Express.Multer.File, user: IUserWithPermissions): Promise<ImportPropertiesResult> {
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
    const skippedNames = new Set((result.skippedProperties ?? []).map((s: { name: string }) => s.name))

    const rowResults: SyncBulkUpsertRowResult[] = await Promise.all(
      allProperties.map(async (p) => {
        const row = rowIndex++
        const identifier = String(p.expedia_id ?? p.booking_id ?? p.agoda_id ?? p.id)
        const baseResult: SyncBulkUpsertRowResult = {
          row,
          parent_id: p.id,
          name: p.name,
          identifier,
          action: skippedNames.has(p.name) ? 'updated' : 'created',
          dbms: true,
          dashboard: { success: false, reason: 'Not attempted' },
          parser: { success: false, reason: 'Not attempted' }
        }

        const [dashboardResult, parserResult] = await Promise.all([
          this.syncUpsertPropertyToDashboard(p as PropertyWithRelations).catch(e => ({
            success: false, reason: e?.message ?? String(e)
          })),
          this.fanOutPropertyCreate({
            name:               p.name,
            portfolio_name:     p.portfolio?.name ?? null,
            sub_portfolio_name: p.subportfolio?.name ?? null,
            expedia_id:         p.expedia_id ?? null,
            expedia_status:     p.expedia_status ?? null,
            booking_id:         p.booking_id ?? null,
            booking_status:     p.booking_status ?? null,
            agoda_id:           p.agoda_id ?? null,
            agoda_status:       p.agoda_status ?? null
          }).catch(e => ({ success: false, reason: e?.message ?? String(e) }))
        ])

        return { ...baseResult, dashboard: dashboardResult, parser: parserResult }
      })
    )

    // Fire email asynchronously — don't block the response
    const failedRows = rowResults.filter(r => !r.dashboard.success || !r.parser.success)
    const defectiveRows = failedRows.map(r => {
      const reasons: string[] = []
      if (!r.dashboard.success && r.dashboard.reason) reasons.push(`Dashboard: ${r.dashboard.reason}`)
      if (!r.parser.success && r.parser.reason) reasons.push(`Parser: ${r.parser.reason}`)
      return {
        Row: r.row, name: r.name, identifier: r.identifier,
        Portfolio: allProperties.find(p => p.id === r.parent_id)?.portfolio?.name ?? '',
        'Expedia ID': allProperties.find(p => p.id === r.parent_id)?.expedia_id ?? '',
        'Booking ID': allProperties.find(p => p.id === r.parent_id)?.booking_id ?? '',
        'Agoda ID': allProperties.find(p => p.id === r.parent_id)?.agoda_id ?? '',
        DBMS: 'YES', Dashboard: r.dashboard.success ? 'YES' : 'NO',
        Parser: r.parser.success ? 'YES' : 'NO',
        Reason: reasons.join(' | ') || 'N/A'
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(defectiveRows.length ? defectiveRows : [{ note: 'All rows synced successfully' }]), 'Sync Results')
    const excelBuffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    const filename = `import-sync-report-${new Date().toISOString().slice(0, 10)}.xlsx`

    this.emailUtil
      .sendBulkSyncResultEmail(user.email, rowResults, excelBuffer, filename)
      .catch(e => this.logger.error(`[email] import sync report failed: ${e?.message ?? e}`))

    return result
  }
  
  private async fanOutPropertyBulkCreate(properties: any[]) {
    if (!this.scraperClient) {
      this.logger.warn('[sync] scraper disabled, skipping bulk import sync')
      return
    }
    if (!properties.length) return
  
    const items = properties.map((p) => ({
      name:               p.name,
      portfolio_name:     p.portfolio?.name ?? null,
      sub_portfolio_name: p.subportfolio?.name ?? null,
      expedia_id:         p.expedia_id ?? null,
      expedia_status:     p.expedia_status ?? null,
      booking_id:         p.booking_id ?? null,
      booking_status:     p.booking_status ?? null,
      agoda_id:           p.agoda_id ?? null,
      agoda_status:       p.agoda_status ?? null,
    }))
  
    try {
      const r = await this.scraperClient.post('/properties/sync-bulk-create', { items })
      this.logger.log(`[sync] scraper bulk create: ${JSON.stringify(r.data?.data ?? r.data)}`)
    } catch (e: any) {
      this.logger.error(`[sync] scraper bulk create failed: ${e?.message ?? e}`)
    }
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
    const findValue = (row: Record<string, any>, names: string[]): string | undefined => {
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
          const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000)
          return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100
            ? date
            : null
        }
        const dateString = String(dateValue).trim()
        const parts = dateString.split('/')
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10)
          const day = parseInt(parts[1], 10)
          const year = parseInt(parts[2], 10)
          if (!isNaN(month) && !isNaN(day) && !isNaN(year) && year >= 1900 && year <= 2100) {
            return new Date(year, month - 1, day)
          }
        }
        const date = new Date(dateString)
        return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100
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
          const propertyIdentifierRaw = findValue(row, ['Property Identifier', 'Property identifier', 'Identifier'])
          const normalizedRowIdentifier = propertyIdentifierRaw
            ? normalizePropertyIdentifier(propertyIdentifierRaw)
            : undefined
          const propertyName = findValue(row, ['Property Name', 'Property name', 'Name'])

          if (!normalizedRowIdentifier && !propertyName) {
            result.errors.push({ row: rowNumber, propertyName: 'Unknown', error: 'Either Property Identifier or Property Name is required' })
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
          if (accessibleIds !== 'all' && !accessibleIds.includes(existingProperty.id)) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'You do not have permission to update this property' })
            result.failureCount++
            continue
          }

          const propertyId = existingProperty.id
          const updateData: Record<string, any> = {}

          // Normalize to UPPER_SNAKE_CASE (ServiceType and Frequency)
          const toUpperSnakeCase = (val: string): string =>
            val.trim().toUpperCase().replace(/[\s\-.]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')

          // Helper functions to resolve names to ObjectIds (find-or-create)
          const resolveProcessor = async (name?: string): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.processor.findFirst({ where: { name: { equals: normalized, mode: 'insensitive' } } })
            if (!rec) {
              const last = await this.prisma.processor.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              rec = await this.prisma.processor.create({ data: { name: normalized, is_active: true, order: (last?.order ?? 0) + 1 } })
            }
            return rec.id
          }
          const resolveServiceType = async (name?: string): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = toUpperSnakeCase(name)
            let rec = await this.prisma.serviceType.findFirst({ where: { type: { equals: normalized, mode: 'insensitive' } } })
            if (!rec) {
              const maxOrder = await this.prisma.serviceType.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              rec = await this.prisma.serviceType.create({ data: { type: normalized, is_active: true, order: (maxOrder?.order ?? 0) + 1 } })
            }
            return rec.id
          }
          const resolveBillingType = async (name?: string): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.billingType.findFirst({ where: { name: { equals: normalized, mode: 'insensitive' } } })
            if (!rec) {
              const last = await this.prisma.billingType.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              rec = await this.prisma.billingType.create({ data: { name: normalized, is_active: true, order: (last?.order ?? 0) + 1 } })
            }
            return rec.id
          }
          const resolveFrequency = async (name?: string): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = toUpperSnakeCase(name)
            let rec = await this.prisma.frequency.findFirst({ where: { name: { equals: normalized, mode: 'insensitive' } } })
            if (!rec) {
              const last = await this.prisma.frequency.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              rec = await this.prisma.frequency.create({ data: { name: normalized, is_active: true, order: (last?.order ?? 0) + 1 } })
            }
            return rec.id
          }
          const resolvePriority = async (name?: string): Promise<string | undefined> => {
            if (!name) return undefined
            const normalized = name.trim()
            let rec = await this.prisma.priority.findFirst({ where: { name: { equals: normalized, mode: 'insensitive' } } })
            if (!rec) {
              const last = await this.prisma.priority.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              rec = await this.prisma.priority.create({ data: { name: normalized, is_active: true, order: (last?.order ?? 0) + 1 } })
            }
            return rec.id
          }

          // Rename: only possible when matched by property_identifier.
          // The "Property Name" column then carries the new name.
          if (matchedByIdentifier && propertyName && propertyName !== existingProperty.name) {
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
                error: 'Property identifier already exists and cannot be updated'
              })
              result.failureCount++
              continue
            }

            if (!propertyName) {
              result.errors.push({
                row: rowNumber,
                propertyName: existingProperty.name,
                error: 'Property Name is required to assign a property identifier'
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
          const hotelAddress = findValue(row, ['Hotel Address', 'Hotel address', 'Address', 'Property Address'])
          if (hotelAddress !== undefined) updateData.hotel_address = hotelAddress

          // Card descriptor
          const cardDescriptor = findValue(row, ['Card Descriptor', 'Card descriptor', 'Descriptor'])
          if (cardDescriptor !== undefined) updateData.card_descriptor = cardDescriptor

          // Description
          const description = findValue(row, ['Description', 'Desc'])
          if (description !== undefined) updateData.description = description

          // Service type
          const serviceType = findValue(row, ['Service Type', 'Service type'])
          if (serviceType !== undefined) updateData.service_type_id = await resolveServiceType(serviceType)

          // Currency — resolve code → currency_id (find or create)
          const currencyCode = findValue(row, ['Currency', 'currency'])
          if (currencyCode !== undefined) {
            const normalized = currencyCode.trim().toUpperCase()
            let currencyRec = await this.prisma.currency.findFirst({ where: { code: { equals: normalized, mode: 'insensitive' } } })
            if (!currencyRec) {
              const last = await this.prisma.currency.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
              currencyRec = await this.prisma.currency.create({ data: { code: normalized, name: normalized, is_active: true, order: (last?.order ?? 0) + 1 } })
            }
            updateData.currency_id = currencyRec.id
          }

          // Next due date
          const nextDueDateRaw = getRawValue(row, ['Next Due Date', 'Next due date', 'Due Date'])
          if (nextDueDateRaw) {
            const nextDueDate = parseDate(nextDueDateRaw)
            if (!nextDueDate) {
              result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Invalid date format for Next Due Date (expected mm/dd/yyyy)' })
              result.failureCount++
              continue
            }
            updateData.next_due_date = nextDueDate.toISOString()
          }

          // Portfolio (look up by name)
          const portfolioName = findValue(row, ['Portfolio', 'Portfolio Name', 'Portfolio name'])
          if (portfolioName) {
            const portfolio = await this.prisma.portfolio.findFirst({ where: { name: portfolioName } })
            if (!portfolio) {
              result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: `Portfolio not found: ${portfolioName}` })
              result.failureCount++
              continue
            }
            updateData.portfolio_id = portfolio.id
          }

          // Case management contact
          const caseContact = findValue(row, ['Case Management Contact', 'Case management contact', 'Case Contact'])
          if (caseContact !== undefined) updateData.case_management_contact = caseContact

          // Access contact
          const accessContact = findValue(row, ['Access Contact', 'Access contact'])
          if (accessContact !== undefined) updateData.access_contact = accessContact

          // Reporting contact
          const reportingContact = findValue(row, ['Reporting Contact', 'Reporting contact'])
          if (reportingContact !== undefined) updateData.reporting_contact = reportingContact

          // Processors
          const expediaProcessor = findValue(row, ['Expedia Processor', 'Expedia processor'])
          if (expediaProcessor !== undefined) updateData.expedia_processor_id = await resolveProcessor(expediaProcessor)

          const bookingProcessor = findValue(row, ['Booking Processor', 'Booking processor'])
          if (bookingProcessor !== undefined) updateData.booking_processor_id = await resolveProcessor(bookingProcessor)

          const agodaProcessor = findValue(row, ['Agoda Processor', 'Agoda processor'])
          if (agodaProcessor !== undefined) updateData.agoda_processor_id = await resolveProcessor(agodaProcessor)

          // FP MID
          const fpMid = findValue(row, ['FP MID', 'FP Mid', 'fp_mid'])
          if (fpMid !== undefined) updateData.fp_mid = fpMid

          // Stripe account email
          const stripeEmail = findValue(row, ['Stripe Account Email', 'Stripe account email', 'Stripe Email'])
          if (stripeEmail !== undefined) updateData.stripe_account_email = stripeEmail

          // New domains email
          const newDomainsEmail = findValue(row, ['New Domains Email', 'New domains email', 'new_domain_email'])
          if (newDomainsEmail !== undefined) updateData.new_domain_email = newDomainsEmail

          // Portfolio contact
          const portfolioContact = findValue(row, ['Portfolio Contact', 'Portfolio contact'])
          if (portfolioContact !== undefined) updateData.portfolio_contact = portfolioContact

          // Portfolio contact email
          const portfolioContactEmail = findValue(row, ['Portfolio Contact Email', 'Portfolio contact email'])
          if (portfolioContactEmail !== undefined) updateData.portfolio_contact_email = portfolioContactEmail

          // is_active flag
          const isActiveStr = findValue(row, ['Is Active', 'is_active', 'Active'])
          if (isActiveStr !== undefined) {
            const lower = isActiveStr.toLowerCase()
            if (lower === 'true' || lower === '1' || lower === 'yes') updateData.is_active = true
            else if (lower === 'false' || lower === '0' || lower === 'no') updateData.is_active = false
          }

          // Helper: parse boolean cell values
          const parseBoolCell = (val: string | undefined): boolean | undefined => {
            if (val === undefined) return undefined
            const l = val.toLowerCase()
            if (l === 'true' || l === '1' || l === 'yes') return true
            if (l === 'false' || l === '0' || l === 'no') return false
            return undefined
          }

          // ── Expedia OTA fields ─────────────────────────────────────────────
          const expediaIdVal = findValue(row, ['Expedia ID', 'Expedia id'])
          if (expediaIdVal !== undefined) { const n = parseInt(expediaIdVal); if (!isNaN(n)) updateData.expedia_id = n }
          const expediaStatus = findValue(row, ['Expedia Status', 'Expedia status'])
          if (expediaStatus !== undefined) updateData.expedia_status = expediaStatus
          const expediaBillingType = findValue(row, ['Expedia Billing Type', 'Expedia billing type'])
          if (expediaBillingType !== undefined) updateData.expedia_billing_type_id = await resolveBillingType(expediaBillingType)
          const expediaServiceType = findValue(row, ['Expedia Service Type', 'Expedia service type'])
          if (expediaServiceType !== undefined) updateData.expedia_service_type_id = await resolveServiceType(expediaServiceType)
          const expediaFrequency = findValue(row, ['Expedia Frequency', 'Expedia frequency'])
          if (expediaFrequency !== undefined) updateData.expedia_frequency_id = await resolveFrequency(expediaFrequency)
          const expediaPriority = findValue(row, ['Expedia Priority', 'Expedia priority'])
          if (expediaPriority !== undefined) updateData.expedia_priority_id = await resolvePriority(expediaPriority)
          const expediaAccessLevelBool = parseBoolCell(findValue(row, ['Expedia Access Level', 'Expedia access level']))
          if (expediaAccessLevelBool !== undefined) updateData.expedia_access_level = expediaAccessLevelBool
          const expediaFrom = findValue(row, ['Expedia From', 'Expedia from'])
          if (expediaFrom !== undefined) updateData.expedia_from = expediaFrom
          const expediaTo = findValue(row, ['Expedia To', 'Expedia to'])
          if (expediaTo !== undefined) updateData.expedia_to = expediaTo
          const expediaSchedulerBool = parseBoolCell(findValue(row, ['Expedia Scheduler', 'Expedia scheduler']))
          if (expediaSchedulerBool !== undefined) updateData.expedia_scheduler = expediaSchedulerBool
          const expediaDurationVal = findValue(row, ['Expedia Duration', 'Expedia duration'])
          if (expediaDurationVal !== undefined) { const n = parseInt(expediaDurationVal); if (!isNaN(n)) updateData.expedia_duration = n }
          const expediaServiceFeeVal = findValue(row, ['Expedia Service Fee', 'Expedia service fee'])
          if (expediaServiceFeeVal !== undefined) { const n = parseInt(expediaServiceFeeVal); if (!isNaN(n)) updateData.expedia_service_fee = n }
          const expediaCrs = findValue(row, ['Expedia CRS', 'Expedia crs'])
          if (expediaCrs !== undefined) updateData.expedia_crs = expediaCrs
          const expediaCrsDb = findValue(row, ['Expedia CRS DB', 'Expedia crs db'])
          if (expediaCrsDb !== undefined) updateData.expedia_crs_db = expediaCrsDb
          const expediaRunDateFrom = findValue(row, ['Expedia Run Date From', 'Expedia run date from'])
          if (expediaRunDateFrom !== undefined) updateData.expedia_run_date_from = expediaRunDateFrom
          const expediaRunDateTo = findValue(row, ['Expedia Run Date To', 'Expedia run date to'])
          if (expediaRunDateTo !== undefined) updateData.expedia_run_date_to = expediaRunDateTo
          const expediaRunDateDbFrom = findValue(row, ['Expedia Run Date DB From', 'Expedia run date db from'])
          if (expediaRunDateDbFrom !== undefined) updateData.expedia_run_date_db_from = expediaRunDateDbFrom
          const expediaRunDateDbTo = findValue(row, ['Expedia Run Date DB To', 'Expedia run date db to'])
          if (expediaRunDateDbTo !== undefined) updateData.expedia_run_date_db_to = expediaRunDateDbTo
          const expediaRevisedDate = findValue(row, ['Expedia Revised Date', 'Expedia revised date'])
          if (expediaRevisedDate !== undefined) updateData.expedia_revised_date = expediaRevisedDate
          const expediaSchedulerReviewFrom = findValue(row, ['Expedia Scheduler Review From', 'Expedia scheduler review from'])
          if (expediaSchedulerReviewFrom !== undefined) updateData.expedia_scheduler_review_from = expediaSchedulerReviewFrom
          const expediaSchedulerReviewTo = findValue(row, ['Expedia Scheduler Review To', 'Expedia scheduler review to'])
          if (expediaSchedulerReviewTo !== undefined) updateData.expedia_scheduler_review_to = expediaSchedulerReviewTo
          const expediaSchedulerDb = findValue(row, ['Expedia Scheduler DB', 'Expedia scheduler db'])
          if (expediaSchedulerDb !== undefined) updateData.expedia_scheduler_db = expediaSchedulerDb
          const expediaSchedulerReviewDbFrom = findValue(row, ['Expedia Scheduler Review DB From', 'Expedia scheduler review db from'])
          if (expediaSchedulerReviewDbFrom !== undefined) updateData.expedia_scheduler_review_db_from = expediaSchedulerReviewDbFrom
          const expediaSchedulerReviewDbTo = findValue(row, ['Expedia Scheduler Review DB To', 'Expedia scheduler review db to'])
          if (expediaSchedulerReviewDbTo !== undefined) updateData.expedia_scheduler_review_db_to = expediaSchedulerReviewDbTo
          const expediaDbDurationVal = findValue(row, ['Expedia DB Duration', 'Expedia db duration'])
          if (expediaDbDurationVal !== undefined) { const n = parseInt(expediaDbDurationVal); if (!isNaN(n)) updateData.expedia_db_duration = n }
          const expediaCredVerified = parseBoolCell(findValue(row, ['Expedia Credential Verified', 'Expedia credential verified']))
          if (expediaCredVerified !== undefined) updateData.expedia_credential_verified = expediaCredVerified
          const expediaOtpNumber = findValue(row, ['Expedia OTP Number', 'Expedia otp number'])
          if (expediaOtpNumber !== undefined) updateData.expedia_otp_number = expediaOtpNumber

          // From DB / To DB
          const fromDb = findValue(row, ['From DB', 'From db'])
          if (fromDb !== undefined) updateData.from_db = fromDb
          const toDb = findValue(row, ['To DB', 'To db'])
          if (toDb !== undefined) updateData.to_db = toDb

          // ── Booking OTA fields ────────────────────────────────────────────
          const bookingIdVal = findValue(row, ['Booking ID', 'Booking id'])
          if (bookingIdVal !== undefined) { const n = parseInt(bookingIdVal); if (!isNaN(n)) updateData.booking_id = n }
          const bookingStatus = findValue(row, ['Booking Status', 'Booking status'])
          if (bookingStatus !== undefined) updateData.booking_status = bookingStatus
          const bookingBillingType = findValue(row, ['Booking Billing Type', 'Booking billing type'])
          if (bookingBillingType !== undefined) updateData.booking_billing_type_id = await resolveBillingType(bookingBillingType)
          const bookingServiceType = findValue(row, ['Booking Service Type', 'Booking service type'])
          if (bookingServiceType !== undefined) updateData.booking_service_type_id = await resolveServiceType(bookingServiceType)
          const bookingFrequency = findValue(row, ['Booking Frequency', 'Booking frequency'])
          if (bookingFrequency !== undefined) updateData.booking_frequency_id = await resolveFrequency(bookingFrequency)
          const bookingPriority = findValue(row, ['Booking Priority', 'Booking priority'])
          if (bookingPriority !== undefined) updateData.booking_priority_id = await resolvePriority(bookingPriority)
          const bookingAccessLevelBool = parseBoolCell(findValue(row, ['Booking Access Level', 'Booking access level']))
          if (bookingAccessLevelBool !== undefined) updateData.booking_access_level = bookingAccessLevelBool
          const bookingFrom = findValue(row, ['Booking From', 'Booking from'])
          if (bookingFrom !== undefined) updateData.booking_from = bookingFrom
          const bookingTo = findValue(row, ['Booking To', 'Booking to'])
          if (bookingTo !== undefined) updateData.booking_to = bookingTo
          const bookingSchedulerBool = parseBoolCell(findValue(row, ['Booking Scheduler', 'Booking scheduler']))
          if (bookingSchedulerBool !== undefined) updateData.booking_scheduler = bookingSchedulerBool
          const bookingDurationVal = findValue(row, ['Booking Duration', 'Booking duration'])
          if (bookingDurationVal !== undefined) { const n = parseInt(bookingDurationVal); if (!isNaN(n)) updateData.booking_duration = n }
          const bookingServiceFeeVal = findValue(row, ['Booking Service Fee', 'Booking service fee'])
          if (bookingServiceFeeVal !== undefined) { const n = parseInt(bookingServiceFeeVal); if (!isNaN(n)) updateData.booking_service_fee = n }
          const bookingCrs = findValue(row, ['Booking CRS', 'Booking crs'])
          if (bookingCrs !== undefined) updateData.booking_crs = bookingCrs
          const bookingRunDate = findValue(row, ['Booking Run Date', 'Booking run date'])
          if (bookingRunDate !== undefined) updateData.booking_run_date = bookingRunDate
          const bookingRevisedDate = findValue(row, ['Booking Revised Date', 'Booking revised date'])
          if (bookingRevisedDate !== undefined) updateData.booking_revised_date = bookingRevisedDate
          const bookingCredVerified = parseBoolCell(findValue(row, ['Booking Credential Verified', 'Booking credential verified']))
          if (bookingCredVerified !== undefined) updateData.booking_credential_verified = bookingCredVerified
          const bookingOtpNumber = findValue(row, ['Booking OTP Number', 'Booking otp number'])
          if (bookingOtpNumber !== undefined) updateData.booking_otp_number = bookingOtpNumber
          const bookingOtpPhone = findValue(row, ['Booking OTP Phone', 'Booking otp phone'])
          if (bookingOtpPhone !== undefined) updateData.booking_otp_phone = bookingOtpPhone

          // ── Agoda OTA fields ──────────────────────────────────────────────
          const agodaIdVal = findValue(row, ['Agoda ID', 'Agoda id'])
          if (agodaIdVal !== undefined) { const n = parseInt(agodaIdVal); if (!isNaN(n)) updateData.agoda_id = n }
          const agodaStatus = findValue(row, ['Agoda Status', 'Agoda status'])
          if (agodaStatus !== undefined) updateData.agoda_status = agodaStatus
          const agodaBillingType = findValue(row, ['Agoda Billing Type', 'Agoda billing type'])
          if (agodaBillingType !== undefined) updateData.agoda_billing_type_id = await resolveBillingType(agodaBillingType)
          const agodaServiceType = findValue(row, ['Agoda Service Type', 'Agoda service type'])
          if (agodaServiceType !== undefined) updateData.agoda_service_type_id = await resolveServiceType(agodaServiceType)
          const agodaFrequency = findValue(row, ['Agoda Frequency', 'Agoda frequency'])
          if (agodaFrequency !== undefined) updateData.agoda_frequency_id = await resolveFrequency(agodaFrequency)
          const agodaPriority = findValue(row, ['Agoda Priority', 'Agoda priority'])
          if (agodaPriority !== undefined) updateData.agoda_priority_id = await resolvePriority(agodaPriority)
          const agodaAccessLevelBool = parseBoolCell(findValue(row, ['Agoda Access Level', 'Agoda access level']))
          if (agodaAccessLevelBool !== undefined) updateData.agoda_access_level = agodaAccessLevelBool
          const agodaFrom = findValue(row, ['Agoda From', 'Agoda from'])
          if (agodaFrom !== undefined) updateData.agoda_from = agodaFrom
          const agodaTo = findValue(row, ['Agoda To', 'Agoda to'])
          if (agodaTo !== undefined) updateData.agoda_to = agodaTo
          const agodaSchedulerBool = parseBoolCell(findValue(row, ['Agoda Scheduler', 'Agoda scheduler']))
          if (agodaSchedulerBool !== undefined) updateData.agoda_scheduler = agodaSchedulerBool
          const agodaDurationVal = findValue(row, ['Agoda Duration', 'Agoda duration'])
          if (agodaDurationVal !== undefined) { const n = parseInt(agodaDurationVal); if (!isNaN(n)) updateData.agoda_duration = n }
          const agodaServiceFeeVal = findValue(row, ['Agoda Service Fee', 'Agoda service fee'])
          if (agodaServiceFeeVal !== undefined) { const n = parseInt(agodaServiceFeeVal); if (!isNaN(n)) updateData.agoda_service_fee = n }
          const agodaCrs = findValue(row, ['Agoda CRS', 'Agoda crs'])
          if (agodaCrs !== undefined) updateData.agoda_crs = agodaCrs
          const agodaRunDate = findValue(row, ['Agoda Run Date', 'Agoda run date'])
          if (agodaRunDate !== undefined) updateData.agoda_run_date = agodaRunDate
          const agodaRevisedDate = findValue(row, ['Agoda Revised Date', 'Agoda revised date'])
          if (agodaRevisedDate !== undefined) updateData.agoda_revised_date = agodaRevisedDate
          const agodaCredVerified = parseBoolCell(findValue(row, ['Agoda Credential Verified', 'Agoda credential verified']))
          if (agodaCredVerified !== undefined) updateData.agoda_credential_verified = agodaCredVerified
          const agodaOtpNumber = findValue(row, ['Agoda OTP Number', 'Agoda otp number'])
          if (agodaOtpNumber !== undefined) updateData.agoda_otp_number = agodaOtpNumber

          // ── Misc fields ───────────────────────────────────────────────────
          const needAnotherDomain = parseBoolCell(findValue(row, ['Need Another Domain', 'Need another domain']))
          if (needAnotherDomain !== undefined) updateData.need_another_domain = needAnotherDomain
          const salesRep = findValue(row, ['Sales Rep', 'Sales rep'])
          if (salesRep !== undefined) updateData.sales_rep = salesRep
          const caseContactEmail = findValue(row, ['Case Contact Email', 'Case contact email', 'Primary Case Email'])
          if (caseContactEmail !== undefined) updateData.primary_case_email = caseContactEmail

          // ── QP / FP credentials (stored on Property, encrypted) ───────────
          const qpUsername = findValue(row, ['Qp Username', 'QP Username'])
          if (qpUsername !== undefined) updateData.qp_username = qpUsername
          const qpPasswordVal = findValue(row, ['Qp Password', 'QP Password'])
          if (qpPasswordVal !== undefined) updateData.qp_password = this.encryptionUtil.encrypt(qpPasswordVal)
          const qpApiKeyVal = findValue(row, ['Qp Api Key', 'QP Api Key', 'QP API Key'])
          if (qpApiKeyVal !== undefined) updateData.qp_api_key = this.encryptionUtil.encrypt(qpApiKeyVal)
          const fpUsernameVal = findValue(row, ['FP Username', 'Fp Username'])
          if (fpUsernameVal !== undefined) updateData.fp_username = fpUsernameVal
          const fpPasswordVal = findValue(row, ['FP Password', 'Fp Password'])
          if (fpPasswordVal !== undefined) updateData.fp_password = this.encryptionUtil.encrypt(fpPasswordVal)
          const webmailPasswordVal = findValue(row, ['Webmail Password', 'Webmail password'])
          if (webmailPasswordVal !== undefined) updateData.webmail_password = this.encryptionUtil.encrypt(webmailPasswordVal)

          // ── Credential fields (PropertyCredentials collection) ─────────────
          const expediaUsername = findValue(row, ['Expedia Username', 'Expedia username'])
          const expediaPassword = findValue(row, ['Expedia Password', 'Expedia password'])
          const agodaUsername = findValue(row, ['Agoda Username', 'Agoda username'])
          const agodaPassword = findValue(row, ['Agoda Password', 'Agoda password'])
          const bookingUsername = findValue(row, ['Booking Username', 'Booking username'])
          const bookingPassword = findValue(row, ['Booking Password', 'Booking password'])
          const expediaSecondaryUsername = findValue(row, ['Expedia Secondary Username', 'Expedia secondary username'])
          const expediaSecondaryPassword = findValue(row, ['Expedia Secondary Password', 'Expedia secondary password'])
          const bookingSecondaryUsername = findValue(row, ['Booking Secondary Username', 'Booking secondary username'])
          const bookingSecondaryPassword = findValue(row, ['Booking Secondary Password', 'Booking secondary password'])
          const agodaSecondaryUsername = findValue(row, ['Agoda Secondary Username', 'Agoda secondary username'])
          const agodaSecondaryPassword = findValue(row, ['Agoda Secondary Password', 'Agoda secondary password'])

          // Validate credential pairs: if one is provided, the other must be too
          if (!!expediaUsername !== !!expediaPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Expedia username and password must be provided together' })
            result.failureCount++
            continue
          }
          if (!!agodaUsername !== !!agodaPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Agoda username and password must be provided together' })
            result.failureCount++
            continue
          }
          if (!!bookingUsername !== !!bookingPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Booking username and password must be provided together' })
            result.failureCount++
            continue
          }
          if (!!expediaSecondaryUsername !== !!expediaSecondaryPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Expedia secondary username and password must be provided together' })
            result.failureCount++
            continue
          }
          if (!!bookingSecondaryUsername !== !!bookingSecondaryPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Booking secondary username and password must be provided together' })
            result.failureCount++
            continue
          }
          if (!!agodaSecondaryUsername !== !!agodaSecondaryPassword) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'Agoda secondary username and password must be provided together' })
            result.failureCount++
            continue
          }

          const hasCredentialsUpdate =
            expediaUsername || expediaPassword ||
            agodaUsername || agodaPassword ||
            bookingUsername || bookingPassword ||
            expediaSecondaryUsername || expediaSecondaryPassword ||
            bookingSecondaryUsername || bookingSecondaryPassword ||
            agodaSecondaryUsername || agodaSecondaryPassword

          const hasPropertyUpdate = Object.keys(updateData).length > 0

          if (!hasPropertyUpdate && !hasCredentialsUpdate) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'No fields to update (all cells are empty)' })
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
            if (expediaUsername !== undefined) credentialsData.expediaUsername = expediaUsername
            if (expediaPassword) credentialsData.expediaPassword = this.encryptionUtil.encrypt(expediaPassword)
            if (agodaUsername !== undefined) credentialsData.agodaUsername = agodaUsername
            if (agodaPassword) credentialsData.agodaPassword = this.encryptionUtil.encrypt(agodaPassword)
            if (bookingUsername !== undefined) credentialsData.bookingUsername = bookingUsername
            if (bookingPassword) credentialsData.bookingPassword = this.encryptionUtil.encrypt(bookingPassword)
            if (expediaSecondaryUsername !== undefined) credentialsData.expediaSecondaryUsername = expediaSecondaryUsername
            if (expediaSecondaryPassword) credentialsData.expediaSecondaryPassword = this.encryptionUtil.encrypt(expediaSecondaryPassword)
            if (bookingSecondaryUsername !== undefined) credentialsData.bookingSecondaryUsername = bookingSecondaryUsername
            if (bookingSecondaryPassword) credentialsData.bookingSecondaryPassword = this.encryptionUtil.encrypt(bookingSecondaryPassword)
            if (agodaSecondaryUsername !== undefined) credentialsData.agodaSecondaryUsername = agodaSecondaryUsername
            if (agodaSecondaryPassword) credentialsData.agodaSecondaryPassword = this.encryptionUtil.encrypt(agodaSecondaryPassword)

            const existingCredentials = await this.credentialsService.findByPropertyId(propertyId)
            if (existingCredentials) {
              await this.credentialsService.update(existingCredentials.id, credentialsData)
            } else {
              await this.credentialsService.create({ ...credentialsData, property_id: propertyId })
            }
          }

          // Invalidate Redis cache for this property and the all-properties list
          await Promise.all([
            this.redisService.del(CACHE_KEY(propertyId)),
            this.redisService.deleteByPattern(ALL_PATTERN)
          ])

          result.successCount++
          result.successfulUpdates.push(existingProperty.name)
          syncQueue.push({ rowNumber, propertyId: existingProperty.id })
        } catch (error) {
          const nameFromRow =
            findValue(row, ['Property Identifier', 'Property identifier', 'Identifier']) ||
            findValue(row, ['Property Name', 'Property name', 'Name']) ||
            'Unknown'
          result.errors.push({
            row: rowNumber,
            propertyName: nameFromRow,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          })
          result.failureCount++
        }
      }

      // ── Post-loop: run dashboard + scraper sync per updated property, then email ──
      if (syncQueue.length > 0) {
        const rowResults: SyncBulkUpsertRowResult[] = await Promise.all(
          syncQueue.map(async ({ rowNumber, propertyId }) => {
            const p = (await this.repo.findById(propertyId)) as PropertyWithRelations
            const identifier = String(p?.expedia_id ?? p?.booking_id ?? p?.agoda_id ?? propertyId)

            const [dashboardResult, parserResult] = await Promise.all([
              p
                ? this.syncUpsertPropertyToDashboard(p).catch(e => ({ success: false, reason: e?.message ?? String(e) }))
                : Promise.resolve({ success: false, reason: 'Property not found after update' }),
              p
                ? this.fanOutPropertyUpdate(
                    { expedia_id: p.expedia_id ?? null, booking_id: p.booking_id ?? null, agoda_id: p.agoda_id ?? null },
                    { name: p.name, hotel_address: p.hotel_address, card_descriptor: p.card_descriptor, is_active: p.is_active, expedia_id: p.expedia_id, booking_id: p.booking_id, agoda_id: p.agoda_id }
                  ).catch(e => ({ success: false, reason: e?.message ?? String(e) }))
                : Promise.resolve({ success: false, reason: 'Property not found after update' })
            ])

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

        const failedRows = rowResults.filter(r => !r.dashboard.success || !r.parser.success)
        const defectRows = failedRows.map(r => {
          const reasons: string[] = []
          if (!r.dashboard.success && r.dashboard.reason) reasons.push(`Dashboard: ${r.dashboard.reason}`)
          if (!r.parser.success && r.parser.reason) reasons.push(`Parser: ${r.parser.reason}`)
          return {
            Row: r.row, 'Property Name': r.name, Identifier: r.identifier,
            DBMS: 'YES', Dashboard: r.dashboard.success ? 'YES' : 'NO',
            Parser: r.parser.success ? 'YES' : 'NO',
            Reason: reasons.join(' | ') || 'N/A'
          }
        })

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(defectRows.length ? defectRows : [{ note: 'All rows synced successfully' }]),
          'Sync Results'
        )
        const excelBuffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
        const filename = `bulk-update-sync-report-${new Date().toISOString().slice(0, 10)}.xlsx`

        this.emailUtil
          .sendBulkSyncResultEmail(user.email, rowResults, excelBuffer, filename)
          .catch(e => this.logger.error(`[email] bulk-update sync report failed: ${e?.message ?? e}`))
      }

      return result
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException(`Failed to process file: ${(error as Error).message}`)
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
        this.redisService.deleteByPattern(ALL_PATTERN)
      ])
    }

    return {
      success,
      skipped,
      totalProcessed: ids.length,
      successCount: success.length,
      skippedCount: skipped.length
    }
  }

  async findAllCached(
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations[]> {
    const cacheKey = `property:all:${user.id}`
    const cached =
      await this.redisService.get<PropertyWithRelations[]>(cacheKey)
    if (cached) {
      this.logger.log(
        `[CACHE HIT] property:findAllCached — served from Redis (key: ${cacheKey})`
      )
      return cached
    }
    this.logger.log(
      `[CACHE MISS] property:findAllCached — fetching from MongoDB (key: ${cacheKey})`
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
    // TTL 1 hour = auto-refresh cache every hour
    await this.redisService.set(cacheKey, masked, CACHE_TTL_ALL)
    return masked
  }

  async refreshCache(user: IUserWithPermissions) {
    this.logger.log(
      `[MANUAL CACHE REFRESH] Clearing all cache keys (requested by user: ${user.id})`
    )

    // Delete all property cache keys (all users and individual items)
    await this.redisService.deleteByPattern(ALL_PATTERN)
    await this.redisService.deleteByPattern('property:*')
    
    // Delete all portfolio cache keys (portfolios are used in global filter)
    await this.redisService.deleteByPattern('portfolio:*')

    // Delete all subportfolio cache keys (subportfolios are used in global filter)
    await this.redisService.deleteByPattern('subportfolio:all:*')

    this.logger.log(
      `[MANUAL CACHE REFRESH] Successfully cleared all property, portfolio, and subportfolio cache keys`
    )

    return {
      message: 'Cache refreshed successfully. All users will get fresh data on next request.'
    }
  }

  async getAllDataForGlobalFilter(user: IUserWithPermissions) {
    const [portfolios, properties, subportfolios] = await Promise.all([
      this.portfolioService.findAllCached(user),
      this.findAllCached(user),
      this.subportfolioService.findAllCachedForGlobalFilter(user)
    ])

    const uniqueExpediaServiceFees = new Set<string>()
    const expediaPriorityMap = new Map<string, Priority>()
    const uniqueFromDb = new Set<string>()
    const uniqueToDb = new Set<string>()
    let revisedDateMin: string | null = null
    let revisedDateMax: string | null = null
    const uniqueExpediaSchedulerReviewFroms = new Set<string>()
    const uniqueExpediaSchedulerReviewTos = new Set<string>()
    const uniqueExpediaSchedulerReviewDbFroms = new Set<string>()
    const uniqueExpediaSchedulerReviewDbTos = new Set<string>()
    const uniqueExpediaSchedulerDbs = new Set<string>()
    const uniqueExpediaCrs = new Set<string>()
    const uniqueExpediaCrsDbs = new Set<string>()
    const uniqueExpediaRunDateFroms = new Set<string>()
    const uniqueExpediaRunDateTos = new Set<string>()
    const uniqueExpediaRunDateDbFroms = new Set<string>()
    const uniqueExpediaRunDateDbTos = new Set<string>()
    const uniqueExpediaDbDurations = new Set<string>()
    const uniqueExpediaCredentialVerified = new Set<string>()
    const uniqueExpediaOtpNumbers = new Set<string>()
    const uniqueBookingServiceFees = new Set<string>()
    const bookingPriorityMap = new Map<string, Priority>()
    const uniqueBookingCrs = new Set<string>()
    const uniqueBookingRunDates = new Set<string>()
    const uniqueBookingRevisedDates = new Set<string>()
    const uniqueBookingCredentialVerified = new Set<string>()
    const uniqueBookingOtpNumbers = new Set<string>()
    const uniqueAgodaServiceFees = new Set<string>()
    const agodaPriorityMap = new Map<string, Priority>()
    const uniqueAgodaCrs = new Set<string>()
    const uniqueAgodaRunDates = new Set<string>()
    const uniqueAgodaRevisedDates = new Set<string>()
    const uniqueAgodaCredentialVerified = new Set<string>()
    const uniqueAgodaOtpNumbers = new Set<string>()
    const uniqueSalesReps = new Set<string>()
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

    subportfolios.forEach((subportfolio) => {
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
        expediaProcessorMap.set(property.expedia_processor.id, property.expedia_processor)
      if (property.booking_processor)
        bookingProcessorMap.set(property.booking_processor.id, property.booking_processor)
      if (property.agoda_processor)
        agodaProcessorMap.set(property.agoda_processor.id, property.agoda_processor)
      if (property.fp_mid)
        uniqueFpMids.add(property.fp_mid)
      if (property.stripe_account_email)
        uniqueStripeAccountEmails.add(property.stripe_account_email)
      if (property.from)
        uniqueFromDates.add(property.from)
      if (property.to)
        uniqueToDates.add(property.to)
      if (property.portfolio?.id && property.portfolio?.name) {
        portfolioMap.set(property.portfolio.id, {
          id: property.portfolio.id,
          name: property.portfolio.name
        })
      }
      if (property.property_identifier)
        uniquePropertyIdentifiers.add(property.property_identifier)
      if (property.portfolio_contact)
        uniquePortfolioContacts.add(property.portfolio_contact)
      if (property.fp_username) uniqueFpUsernames.add(property.fp_username)
      if (property.expedia_billing_type)
        expediaBillingTypeMap.set(property.expedia_billing_type.id, property.expedia_billing_type)
      if (property.expedia_service_type)
        expediaServiceTypeMap.set(property.expedia_service_type.id, property.expedia_service_type)
      if (property.expedia_frequency)
        expediaFrequencyMap.set(property.expedia_frequency.id, property.expedia_frequency)
      if (property.expedia_from) uniqueExpediaFroms.add(property.expedia_from)
      if (property.expedia_to) uniqueExpediaTos.add(property.expedia_to)
      if (property.expedia_duration != null)
        uniqueExpediaDurations.add(String(property.expedia_duration))
      if (property.expedia_access_level != null)
        uniqueExpediaAccessLevels.add(String(property.expedia_access_level))
      if (property.expedia_scheduler != null)
        uniqueExpediaSchedulers.add(String(property.expedia_scheduler))
      if (property.booking_billing_type)
        bookingBillingTypeMap.set(property.booking_billing_type.id, property.booking_billing_type)
      if (property.booking_service_type)
        bookingServiceTypeMap.set(property.booking_service_type.id, property.booking_service_type)
      if (property.booking_frequency)
        bookingFrequencyMap.set(property.booking_frequency.id, property.booking_frequency)
      if (property.booking_from) uniqueBookingFroms.add(property.booking_from)
      if (property.booking_to) uniqueBookingTos.add(property.booking_to)
      if (property.booking_duration != null)
        uniqueBookingDurations.add(String(property.booking_duration))
      if (property.booking_access_level != null)
        uniqueBookingAccessLevels.add(String(property.booking_access_level))
      if (property.booking_scheduler != null)
        uniqueBookingSchedulers.add(String(property.booking_scheduler))
      if (property.agoda_billing_type)
        agodaBillingTypeMap.set(property.agoda_billing_type.id, property.agoda_billing_type)
      if (property.agoda_service_type)
        agodaServiceTypeMap.set(property.agoda_service_type.id, property.agoda_service_type)
      if (property.agoda_frequency)
        agodaFrequencyMap.set(property.agoda_frequency.id, property.agoda_frequency)
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
      if (property.expedia_service_fee)
        uniqueExpediaServiceFees.add(property.expedia_service_fee)
      if (property.expedia_priority)
        expediaPriorityMap.set(property.expedia_priority.id, property.expedia_priority)
      if (property.from_db)
        uniqueFromDb.add(property.from_db)
      if (property.to_db)
        uniqueToDb.add(property.to_db)
      if (property.expedia_revised_date) {
        if (revisedDateMin === null || property.expedia_revised_date < revisedDateMin)
          revisedDateMin = property.expedia_revised_date
        if (revisedDateMax === null || property.expedia_revised_date > revisedDateMax)
          revisedDateMax = property.expedia_revised_date
      }
      if (property.expedia_scheduler_review_from)
        uniqueExpediaSchedulerReviewFroms.add(property.expedia_scheduler_review_from)
      if (property.expedia_scheduler_review_to)
        uniqueExpediaSchedulerReviewTos.add(property.expedia_scheduler_review_to)
      if (property.expedia_scheduler_review_db_from)
        uniqueExpediaSchedulerReviewDbFroms.add(property.expedia_scheduler_review_db_from)
      if (property.expedia_scheduler_review_db_to)
        uniqueExpediaSchedulerReviewDbTos.add(property.expedia_scheduler_review_db_to)
      if (property.expedia_scheduler_db)
        uniqueExpediaSchedulerDbs.add(property.expedia_scheduler_db)
      if (property.expedia_crs)
        uniqueExpediaCrs.add(property.expedia_crs)
      if (property.expedia_crs_db)
        uniqueExpediaCrsDbs.add(property.expedia_crs_db)
      if (property.expedia_run_date_from)
        uniqueExpediaRunDateFroms.add(property.expedia_run_date_from)
      if (property.expedia_run_date_to)
        uniqueExpediaRunDateTos.add(property.expedia_run_date_to)
      if (property.expedia_run_date_db_from)
        uniqueExpediaRunDateDbFroms.add(property.expedia_run_date_db_from)
      if (property.expedia_run_date_db_to)
        uniqueExpediaRunDateDbTos.add(property.expedia_run_date_db_to)
      if (property.expedia_db_duration != null)
        uniqueExpediaDbDurations.add(String(property.expedia_db_duration))
      if (property.expedia_credential_verified != null)
        uniqueExpediaCredentialVerified.add(String(property.expedia_credential_verified))
      if (property.expedia_otp_number)
        uniqueExpediaOtpNumbers.add(property.expedia_otp_number)
      if (property.booking_service_fee != null)
        uniqueBookingServiceFees.add(String(property.booking_service_fee))
      if (property.booking_priority)
        bookingPriorityMap.set(property.booking_priority.id, property.booking_priority)
      if (property.booking_crs)
        uniqueBookingCrs.add(property.booking_crs)
      if (property.booking_run_date)
        uniqueBookingRunDates.add(property.booking_run_date)
      if (property.booking_revised_date)
        uniqueBookingRevisedDates.add(property.booking_revised_date)
      if (property.booking_credential_verified != null)
        uniqueBookingCredentialVerified.add(String(property.booking_credential_verified))
      if (property.booking_otp_number)
        uniqueBookingOtpNumbers.add(property.booking_otp_number)
      if (property.agoda_service_fee != null)
        uniqueAgodaServiceFees.add(String(property.agoda_service_fee))
      if (property.agoda_priority)
        agodaPriorityMap.set(property.agoda_priority.id, property.agoda_priority)
      if (property.agoda_crs)
        uniqueAgodaCrs.add(property.agoda_crs)
      if (property.agoda_run_date)
        uniqueAgodaRunDates.add(property.agoda_run_date)
      if (property.agoda_revised_date)
        uniqueAgodaRevisedDates.add(property.agoda_revised_date)
      if (property.agoda_credential_verified != null)
        uniqueAgodaCredentialVerified.add(String(property.agoda_credential_verified))
      if (property.agoda_otp_number)
        uniqueAgodaOtpNumbers.add(property.agoda_otp_number)
      if (property.sales_rep)
        uniqueSalesReps.add(property.sales_rep)
    })

    return {
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
      expedia_processor: Array.from(expediaProcessorMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      booking_processor: Array.from(bookingProcessorMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      agoda_processor: Array.from(agodaProcessorMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      fp_mid: Array.from(uniqueFpMids).sort(),
      stripe_account_email: Array.from(uniqueStripeAccountEmails).sort(),
      from: Array.from(uniqueFromDates).sort(),
      to: Array.from(uniqueToDates).sort(),
      property_identifier: Array.from(uniquePropertyIdentifiers).sort(),
      portfolio_contact: Array.from(uniquePortfolioContacts).sort(),
      service_type: Array.from(serviceTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      currency: Array.from(currencyMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      fp_username: Array.from(uniqueFpUsernames).sort(),
      qp_username: Array.from(uniqueQpUsernames).sort(),
      previous_portfolio_id: Array.from(uniquePreviousPortfolioIds).sort(),
      next_due_date: Array.from(uniqueNextDueDates).sort(),
      expedia_billing_type: Array.from(expediaBillingTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      expedia_service_type: Array.from(expediaServiceTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      expedia_frequency: Array.from(expediaFrequencyMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      expedia_from: Array.from(uniqueExpediaFroms).sort(),
      expedia_to: Array.from(uniqueExpediaTos).sort(),
      expedia_duration: Array.from(uniqueExpediaDurations).sort(),
      expedia_access_level: Array.from(uniqueExpediaAccessLevels).sort(),
      expedia_scheduler: Array.from(uniqueExpediaSchedulers).sort(),
      booking_billing_type: Array.from(bookingBillingTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      booking_service_type: Array.from(bookingServiceTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      booking_frequency: Array.from(bookingFrequencyMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      booking_from: Array.from(uniqueBookingFroms).sort(),
      booking_to: Array.from(uniqueBookingTos).sort(),
      booking_duration: Array.from(uniqueBookingDurations).sort(),
      booking_access_level: Array.from(uniqueBookingAccessLevels).sort(),
      booking_scheduler: Array.from(uniqueBookingSchedulers).sort(),
      agoda_billing_type: Array.from(agodaBillingTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      agoda_service_type: Array.from(agodaServiceTypeMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      agoda_frequency: Array.from(agodaFrequencyMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
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
      expedia_service_fee: Array.from(uniqueExpediaServiceFees).sort(),
      expedia_priority: Array.from(expediaPriorityMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      from_db: Array.from(uniqueFromDb).sort(),
      to_db: Array.from(uniqueToDb).sort(),
      expedia_revised_date: { min: revisedDateMin, max: revisedDateMax },
      expedia_scheduler_review_from: Array.from(uniqueExpediaSchedulerReviewFroms).sort(),
      expedia_scheduler_review_to: Array.from(uniqueExpediaSchedulerReviewTos).sort(),
      expedia_scheduler_review_db_from: Array.from(uniqueExpediaSchedulerReviewDbFroms).sort(),
      expedia_scheduler_review_db_to: Array.from(uniqueExpediaSchedulerReviewDbTos).sort(),
      expedia_scheduler_db: Array.from(uniqueExpediaSchedulerDbs).sort(),
      expedia_crs: Array.from(uniqueExpediaCrs).sort(),
      expedia_crs_db: Array.from(uniqueExpediaCrsDbs).sort(),
      expedia_run_date_from: Array.from(uniqueExpediaRunDateFroms).sort(),
      expedia_run_date_to: Array.from(uniqueExpediaRunDateTos).sort(),
      expedia_run_date_db_from: Array.from(uniqueExpediaRunDateDbFroms).sort(),
      expedia_run_date_db_to: Array.from(uniqueExpediaRunDateDbTos).sort(),
      expedia_db_duration: Array.from(uniqueExpediaDbDurations).sort(),
      expedia_credential_verified: Array.from(uniqueExpediaCredentialVerified).sort(),
      expedia_otp_number: Array.from(uniqueExpediaOtpNumbers).sort(),
      booking_service_fee: Array.from(uniqueBookingServiceFees).sort(),
      booking_priority: Array.from(bookingPriorityMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      booking_crs: Array.from(uniqueBookingCrs).sort(),
      booking_run_date: Array.from(uniqueBookingRunDates).sort(),
      booking_revised_date: Array.from(uniqueBookingRevisedDates).sort(),
      booking_credential_verified: Array.from(uniqueBookingCredentialVerified).sort(),
      booking_otp_number: Array.from(uniqueBookingOtpNumbers).sort(),
      agoda_service_fee: Array.from(uniqueAgodaServiceFees).sort(),
      agoda_priority: Array.from(agodaPriorityMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      agoda_crs: Array.from(uniqueAgodaCrs).sort(),
      agoda_run_date: Array.from(uniqueAgodaRunDates).sort(),
      agoda_revised_date: Array.from(uniqueAgodaRevisedDates).sort(),
      agoda_credential_verified: Array.from(uniqueAgodaCredentialVerified).sort(),
      agoda_otp_number: Array.from(uniqueAgodaOtpNumbers).sort(),
      sales_rep: Array.from(uniqueSalesReps).sort(),
    }
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
        return { OR: [{ [fieldName]: { equals: false } }, { [fieldName]: null }] }
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

  private pickFields(src: any, fields: string[]) {
    const out: Record<string, any> = {}
    for (const f of fields) if (src?.[f] !== undefined) out[f] = src[f]
    return out
  }
  private async fanOutPropertyUpdate(
    otaIds: { expedia_id: number | null; booking_id: number | null; agoda_id: number | null },
    data: Record<string, any>
  ): Promise<{ success: boolean; reason?: string }> {
    const jobs: Promise<any>[] = []
    if (this.dashboardClient) {
      jobs.push(this.dashboardClient.patch('/api/property/sync-by-ota', { ...otaIds, data })
        .then(r => ['dashboard', r.data]).catch(e => ['dashboard', { error: e?.message }]))
    }
    let scraperSuccess = true
    let scraperReason: string | undefined
    if (this.scraperClient) {
      jobs.push(this.scraperClient.patch('/properties/sync-by-ota', { ...otaIds, data })
        .then(r => ['scraper', r.data]).catch(e => ['scraper', { error: e?.message }]))
    } else {
      scraperSuccess = false
      scraperReason = 'Scraper client disabled — URL or token missing'
    }
    const results = await Promise.allSettled(jobs)
    for (const r of results) {
      if (r.status === 'fulfilled') {
        this.logger.log(`[sync] ${r.value[0]}: ${JSON.stringify(r.value[1])}`)
        if (r.value[0] === 'scraper' && r.value[1]?.error) {
          scraperSuccess = false
          scraperReason = r.value[1].error
        }
      } else {
        this.logger.error(`[sync] failed: ${r.reason}`)
        scraperSuccess = false
        scraperReason = String(r.reason)
      }
    }
    return { success: scraperSuccess, reason: scraperReason }
  }

  private async fanOutPropertyCreate(property: {
    name: string
    portfolio_name?: string | null
    sub_portfolio_name?: string | null
    expedia_id?: number | null
    expedia_status?: string | null
    booking_id?: number | null
    booking_status?: string | null
    agoda_id?: number | null
    agoda_status?: string | null
  }): Promise<{ success: boolean; reason?: string }> {
    if (!this.scraperClient) {
      const reason = 'Scraper client disabled — URL or token missing'
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }
    try {
      const r = await this.scraperClient.post('/properties/sync-create', property)
      this.logger.log(`[sync] scraper create: ${JSON.stringify(r.data)}`)
      return { success: true }
    } catch (e: any) {
      const reason = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? String(e))
      this.logger.error(`[sync] scraper create failed: ${reason}`)
      return { success: false, reason }
    }
  }

  private async fanOutPropertyDelete(otaIds: {
    expedia_id: number | null
    booking_id: number | null
    agoda_id: number | null
  }) {
    if (!this.scraperClient) {
      this.logger.warn('[sync] scraper disabled, skipping delete sync')
      return
    }
    try {
      const r = await this.scraperClient.post('/properties/sync-delete', otaIds)
      this.logger.log(`[sync] scraper delete: ${JSON.stringify(r.data)}`)
    } catch (e: any) {
      this.logger.error(`[sync] scraper delete failed: ${e?.message ?? e}`)
    }
  }

  private readonly inboundSyncFields = ['name', 'card_descriptor', 'is_active', 'next_due_date',
    'expedia_id', 'expedia_status', 'booking_id', 'booking_status', 'agoda_id', 'agoda_status']
    
  async syncByOta(dto: SyncByOtaDto) {
    if (dto.expedia_id == null && dto.booking_id == null && dto.agoda_id == null) return { status: 'no_ota_ids' }
    const ids = await this.repo.findIdsByOtaIds(dto)
    if (!ids.length) return { status: 'not_found' }
    if (ids.length > 1) { this.logger.warn(`[sync] ambiguous: ${ids.join(',')}`); return { status: 'ambiguous', candidates: ids } }
  
    const patch: Record<string, any> = {}
    for (const k of this.inboundSyncFields) if (dto.data?.[k] !== undefined) patch[k] = dto.data[k]
    if (!Object.keys(patch).length) return { status: 'no_op', id: ids[0] }
  
    const updated = await this.repo.update(ids[0], patch as UpdatePropertyDto)
    await Promise.all([this.redisService.del(CACHE_KEY(updated.id)), this.redisService.deleteByPattern(ALL_PATTERN)])
    return { status: 'updated', id: updated.id }
  }

  private async syncUpsertPropertyToDashboard(
    property: PropertyWithRelations
  ): Promise<{ success: boolean; reason?: string }> {
    if (!this.dashboardJwtClient) {
      const reason = 'Dashboard JWT client disabled — URL or JWT_COMMUNICATION_SECRET missing'
      this.logger.warn(`[sync] ${reason}`)
      return { success: false, reason }
    }

    const credentials = await this.credentialsService.findByPropertyId(property.id)

    const currencyCode = property.currency?.code ?? 'USD'
    const currencyName = property.currency?.name ?? 'USD'

    const payload = {
      name: property.name,
      address: property.hotel_address ?? '',
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
        expedia_password: credentials?.expediaPassword ?? '',
        agoda_id: property.agoda_id?.toString() ?? '',
        agoda_username: credentials?.agodaUsername ?? '',
        agoda_password: credentials?.agodaPassword ?? '',
        booking_id: property.booking_id?.toString() ?? '',
        booking_username: credentials?.bookingUsername ?? '',
        booking_password: credentials?.bookingPassword ?? ''
      }
    }

    try {
      const r = await this.dashboardJwtClient.post(
        `/api/property/sync-upsert/${property.id}`,
        payload,
        { headers: this.syncCommunication.createAuthHeaders() }
      )
      this.logger.log(`[sync] dashboard property upsert: ${JSON.stringify(r.data)}`)
      return { success: true }
    } catch (e: any) {
      const reason = e?.response?.data ? JSON.stringify(e.response.data) : (e?.message ?? String(e))
      this.logger.error(`[sync] dashboard property upsert failed: ${reason}`)
      return { success: false, reason }
    }
  }
}
