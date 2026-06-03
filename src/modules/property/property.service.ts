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
  UpdatePropertyDto
} from './property.dto'
import { mapPropertyToExcelRow, PROPERTY_EXCEL_HEADERS } from '../../common/utils/property-excel.util'
import type {
  ImportPropertiesResult,
  ImportPropertyRow,
  IPropertyRepository,
  IPropertyService,
  PropertyWithRelations
} from './property.interface'

const CACHE_TTL_ITEM = 5 * 60 * 1000 // 5 minutes for individual records
const CACHE_TTL_ALL = 60 * 60 * 1000 // 1 hour for all properties cache
const CACHE_KEY = (id: string) => `property:${id}`
const ALL_PATTERN = 'property:all:*'

@Injectable()
export class PropertyService implements IPropertyService {
  private readonly logger = new Logger(PropertyService.name)

  constructor(
    @Inject('IPropertyRepository')
    private readonly repo: IPropertyRepository,
    @Inject('IPropertyCredentialsService')
    private readonly credentialsService: IPropertyCredentialsService,
    @Inject('IAuthRepository')
    private readonly authRepository: IAuthRepository,
    @Inject('IPortfolioService')
    private readonly portfolioService: IPortfolioService,
    private readonly encryptionUtil: EncryptionUtil,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly emailUtil: EmailUtil
  ) {}

  async create(
    data: CreatePropertyDto,
    _user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    const existing = await this.repo.findByName(data.name)
    if (existing)
      throw new ConflictException('Property with this name already exists')

    const {
      credentials,
      qp_username,
      qp_password,
      qp_api_key,
      fp_password,
      ...propertyData
    } = data

    const encryptedData: any = { ...propertyData }
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
          case 'expedia_processor':
            whereConditions.push({ expedia_processor: { in: values } })
            break
          case 'booking_processor':
            whereConditions.push({ booking_processor: { in: values } })
            break
          case 'agoda_processor':
            whereConditions.push({ agoda_processor: { in: values } })
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
          case 'service_type':
            whereConditions.push({ service_type: { in: values } })
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
          case 'expedia_billing_type':
            whereConditions.push({ expedia_billing_type: { in: values } })
            break
          case 'expedia_service_type':
            whereConditions.push({ expedia_service_type: { in: values } })
            break
          case 'expedia_frequency':
            whereConditions.push({ expedia_frequency: { in: values } })
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
          case 'booking_billing_type':
            whereConditions.push({ booking_billing_type: { in: values } })
            break
          case 'booking_service_type':
            whereConditions.push({ booking_service_type: { in: values } })
            break
          case 'booking_frequency':
            whereConditions.push({ booking_frequency: { in: values } })
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
          case 'agoda_billing_type':
            whereConditions.push({ agoda_billing_type: { in: values } })
            break
          case 'agoda_service_type':
            whereConditions.push({ agoda_service_type: { in: values } })
            break
          case 'agoda_frequency':
            whereConditions.push({ agoda_frequency: { in: values } })
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

  async update(
    id: string,
    data: UpdatePropertyDto,
    user: IUserWithPermissions
  ): Promise<PropertyWithRelations> {
    await this.findOne(id, user)
    if (data.name) {
      const existing = await this.repo.findByName(data.name)
      if (existing && existing.id !== id) {
        throw new ConflictException('Property with this name already exists')
      }
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

  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
    await Promise.all([
      this.redisService.del(CACHE_KEY(id)),
      this.redisService.deleteByPattern(ALL_PATTERN)
    ])
    return { message: 'Property deleted successfully' }
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

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [...PROPERTY_EXCEL_HEADERS]
    })
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

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

    const headers = Object.keys(rawRows[0])

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
      .map(r => {
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
            ? String(r['Expedia Service Type']).trim()
            : undefined,
          expediaFrequency: parseEnum(r['Expedia Frequency']),
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
            ? String(r['Booking Service Type']).trim()
            : undefined,
          bookingFrequency: parseEnum(r['Booking Frequency']),
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
            ? String(r['Agoda Service Type']).trim()
            : undefined,
          agodaFrequency: parseEnum(r['Agoda Frequency']),
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
            ? String(r['Service Type']).trim()
            : undefined
        } satisfies ImportPropertyRow
      })
      .filter(Boolean) as ImportPropertyRow[]

    const result = await this.repo.importProperties(rows)
    await this.redisService.deleteByPattern(ALL_PATTERN)
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
      const data: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet)

      if (!data || data.length === 0) {
        throw new BadRequestException('File is empty or contains no data rows')
      }

      result.totalRows = data.length

      // Fetch accessible IDs once for the whole batch
      const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)

      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const rowNumber = i + 2 // Row 1 is the header in Excel

        try {
          // Match by property_identifier first; fall back to name
          const propertyIdentifier = findValue(row, ['Property Identifier', 'Property identifier', 'Identifier'])
          const propertyName = findValue(row, ['Property Name', 'Property name', 'Name'])

          if (!propertyIdentifier && !propertyName) {
            result.errors.push({ row: rowNumber, propertyName: 'Unknown', error: 'Either Property Identifier or Property Name is required' })
            result.failureCount++
            continue
          }

          let existingProperty: any
          const rowLabel = propertyIdentifier ?? propertyName!

          if (propertyIdentifier) {
            existingProperty = await this.prisma.property.findFirst({ where: { property_identifier: propertyIdentifier } })
            if (!existingProperty) {
              result.errors.push({ row: rowNumber, propertyName: rowLabel, error: `Property not found with identifier: ${propertyIdentifier}` })
              result.failureCount++
              continue
            }
          } else {
            existingProperty = await this.repo.findByName(propertyName!)
            if (!existingProperty) {
              result.errors.push({ row: rowNumber, propertyName: rowLabel, error: `Property not found: ${propertyName}` })
              result.failureCount++
              continue
            }
          }

          // Check access permission
          if (accessibleIds !== 'all' && !accessibleIds.includes(existingProperty.id)) {
            result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: 'You do not have permission to update this property' })
            result.failureCount++
            continue
          }

          const propertyId = existingProperty.id
          const updateData: Record<string, any> = {}

          // Rename: only possible when matched by property_identifier.
          // The "Property Name" column then carries the new name.
          if (propertyIdentifier && propertyName && propertyName !== existingProperty.name) {
            const nameConflict = await this.repo.findByName(propertyName)
            if (nameConflict && nameConflict.id !== propertyId) {
              result.errors.push({ row: rowNumber, propertyName: existingProperty.name, error: `Another property already has the name: ${propertyName}` })
              result.failureCount++
              continue
            }
            updateData.name = propertyName
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
          if (serviceType !== undefined) updateData.service_type = serviceType

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
          if (expediaProcessor !== undefined) updateData.expedia_processor = expediaProcessor

          const bookingProcessor = findValue(row, ['Booking Processor', 'Booking processor'])
          if (bookingProcessor !== undefined) updateData.booking_processor = bookingProcessor

          const agodaProcessor = findValue(row, ['Agoda Processor', 'Agoda processor'])
          if (agodaProcessor !== undefined) updateData.agoda_processor = agodaProcessor

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

          // ── Credential fields ──────────────────────────────────────────────
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

    this.logger.log(
      `[MANUAL CACHE REFRESH] Successfully cleared all property and portfolio cache keys`
    )

    return {
      message: 'Cache refreshed successfully. All users will get fresh data on next request.'
    }
  }

  async getAllDataForGlobalFilter(user: IUserWithPermissions) {
    const [portfolios, properties] = await Promise.all([
      this.portfolioService.findAllCached(user),
      this.findAllCached(user)
    ])

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
    const uniqueExpediaProcessors = new Set<string>()
    const uniqueBookingProcessors = new Set<string>()
    const uniqueAgodaProcessors = new Set<string>()
    const uniqueFpMids = new Set<string>()
    const uniqueStripeAccountEmails = new Set<string>()
    const uniqueFromDates = new Set<string>()
    const uniqueToDates = new Set<string>()
    const uniquePropertyIdentifiers = new Set<string>()
    const uniquePortfolioContacts = new Set<string>()
    const uniqueFpUsernames = new Set<string>()
    const uniqueExpediaBillingTypes = new Set<string>()
    const uniqueExpediaServiceTypes = new Set<string>()
    const uniqueExpediaFrequencies = new Set<string>()
    const uniqueExpediaFroms = new Set<string>()
    const uniqueExpediaTos = new Set<string>()
    const uniqueExpediaDurations = new Set<string>()
    const uniqueBookingBillingTypes = new Set<string>()
    const uniqueBookingServiceTypes = new Set<string>()
    const uniqueBookingFrequencies = new Set<string>()
    const uniqueBookingFroms = new Set<string>()
    const uniqueBookingTos = new Set<string>()
    const uniqueBookingDurations = new Set<string>()
    const uniqueAgodaBillingTypes = new Set<string>()
    const uniqueAgodaServiceTypes = new Set<string>()
    const uniqueAgodaFrequencies = new Set<string>()
    const uniqueAgodaFroms = new Set<string>()
    const uniqueAgodaTos = new Set<string>()
    const uniqueAgodaDurations = new Set<string>()
    const portfolioIdSet = new Set<string>()
    const subportfolioMap = new Map<
      string,
      { id: string; name: string; portfolio_id: string }
    >()
    const uniqueServiceTypes = new Set<string>()
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

    properties.forEach((property: any) => {
      if (property.portfolio_id) portfolioIdSet.add(property.portfolio_id)
      if (property.service_type)
        uniqueServiceTypes.add(property.service_type)
      if (property.expedia_id) uniqueExpediaIds.add(property.expedia_id)
      if (property.booking_id) uniqueBookingIds.add(property.booking_id)
      if (property.agoda_id) uniqueAgodaIds.add(property.agoda_id)
      if (property.id && property.name) {
        propertyMap.set(property.id, { id: property.id, name: property.name })
      }
      if (property.subportfolio?.id) {
        subportfolioMap.set(property.subportfolio.id, {
          id: property.subportfolio.id,
          name: property.subportfolio.name,
          portfolio_id: property.subportfolio.portfolio_id
        })
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
        uniqueExpediaProcessors.add(property.expedia_processor)
      if (property.booking_processor)
        uniqueBookingProcessors.add(property.booking_processor)
      if (property.agoda_processor)
        uniqueAgodaProcessors.add(property.agoda_processor)
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
        uniqueExpediaBillingTypes.add(property.expedia_billing_type)
      if (property.expedia_service_type)
        uniqueExpediaServiceTypes.add(property.expedia_service_type)
      if (property.expedia_frequency)
        uniqueExpediaFrequencies.add(property.expedia_frequency)
      if (property.expedia_from) uniqueExpediaFroms.add(property.expedia_from)
      if (property.expedia_to) uniqueExpediaTos.add(property.expedia_to)
      if (property.expedia_duration != null)
        uniqueExpediaDurations.add(String(property.expedia_duration))
      if (property.expedia_access_level != null)
        uniqueExpediaAccessLevels.add(String(property.expedia_access_level))
      if (property.expedia_scheduler != null)
        uniqueExpediaSchedulers.add(String(property.expedia_scheduler))
      if (property.booking_billing_type)
        uniqueBookingBillingTypes.add(property.booking_billing_type)
      if (property.booking_service_type)
        uniqueBookingServiceTypes.add(property.booking_service_type)
      if (property.booking_frequency)
        uniqueBookingFrequencies.add(property.booking_frequency)
      if (property.booking_from) uniqueBookingFroms.add(property.booking_from)
      if (property.booking_to) uniqueBookingTos.add(property.booking_to)
      if (property.booking_duration != null)
        uniqueBookingDurations.add(String(property.booking_duration))
      if (property.booking_access_level != null)
        uniqueBookingAccessLevels.add(String(property.booking_access_level))
      if (property.booking_scheduler != null)
        uniqueBookingSchedulers.add(String(property.booking_scheduler))
      if (property.agoda_billing_type)
        uniqueAgodaBillingTypes.add(property.agoda_billing_type)
      if (property.agoda_service_type)
        uniqueAgodaServiceTypes.add(property.agoda_service_type)
      if (property.agoda_frequency)
        uniqueAgodaFrequencies.add(property.agoda_frequency)
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
      expedia_processor: Array.from(uniqueExpediaProcessors).sort(),
      booking_processor: Array.from(uniqueBookingProcessors).sort(),
      agoda_processor: Array.from(uniqueAgodaProcessors).sort(),
      fp_mid: Array.from(uniqueFpMids).sort(),
      stripe_account_email: Array.from(uniqueStripeAccountEmails).sort(),
      from: Array.from(uniqueFromDates).sort(),
      to: Array.from(uniqueToDates).sort(),
      property_identifier: Array.from(uniquePropertyIdentifiers).sort(),
      portfolio_contact: Array.from(uniquePortfolioContacts).sort(),
      service_type: Array.from(uniqueServiceTypes).sort(),
      fp_username: Array.from(uniqueFpUsernames).sort(),
      qp_username: Array.from(uniqueQpUsernames).sort(),
      previous_portfolio_id: Array.from(uniquePreviousPortfolioIds).sort(),
      next_due_date: Array.from(uniqueNextDueDates).sort(),
      expedia_billing_type: Array.from(uniqueExpediaBillingTypes).sort(),
      expedia_service_type: Array.from(uniqueExpediaServiceTypes).sort(),
      expedia_frequency: Array.from(uniqueExpediaFrequencies).sort(),
      expedia_from: Array.from(uniqueExpediaFroms).sort(),
      expedia_to: Array.from(uniqueExpediaTos).sort(),
      expedia_duration: Array.from(uniqueExpediaDurations).sort(),
      expedia_access_level: Array.from(uniqueExpediaAccessLevels).sort(),
      expedia_scheduler: Array.from(uniqueExpediaSchedulers).sort(),
      booking_billing_type: Array.from(uniqueBookingBillingTypes).sort(),
      booking_service_type: Array.from(uniqueBookingServiceTypes).sort(),
      booking_frequency: Array.from(uniqueBookingFrequencies).sort(),
      booking_from: Array.from(uniqueBookingFroms).sort(),
      booking_to: Array.from(uniqueBookingTos).sort(),
      booking_duration: Array.from(uniqueBookingDurations).sort(),
      booking_access_level: Array.from(uniqueBookingAccessLevels).sort(),
      booking_scheduler: Array.from(uniqueBookingSchedulers).sort(),
      agoda_billing_type: Array.from(uniqueAgodaBillingTypes).sort(),
      agoda_service_type: Array.from(uniqueAgodaServiceTypes).sort(),
      agoda_frequency: Array.from(uniqueAgodaFrequencies).sort(),
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
      ).sort()
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
    
    // If only one value, use equals
    if (bools.length === 1) {
      return { [fieldName]: { equals: bools[0] } }
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
}
