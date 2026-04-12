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
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IAuthRepository } from '../auth/auth.interface'
import type { IPortfolioService } from '../portfolio/portfolio.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsService } from '../property-credentials/property-credentials.interface'
import { RedisService } from '../redis/redis.service'
import {
  CreatePropertyDto,
  GetPropertyCredentialDto,
  PropertyFilterDto,
  RequiredFieldType,
  UpdatePropertyDto
} from './property.dto'
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
    private readonly redisService: RedisService
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
      ...propertyData
    } = data

    const encryptedData: any = { ...propertyData }
    if (qp_username) encryptedData.qp_username = qp_username
    if (qp_password)
      encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key)
      encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
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

    if (filterDto.filters && Array.isArray(filterDto.filters)) {
      for (const filter of filterDto.filters) {
        const { name, sort_by, in: values } = filter

        // Collect sort_by for multi-field sorting (independent of filter values)
        if (sort_by) {
          // Handle special cases for relation fields
          if (name === 'portfolio_id') {
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
          { hotel_address: { contains: filterDto.search, mode: 'insensitive' } }
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
    if (prop.credentials && Array.isArray(prop.credentials)) {
      result.credentials = (prop.credentials as any[]).map((cred: any) => {
        const decrypted: any = { ...cred }
        for (const field of [
          'expediaPassword',
          'agodaPassword',
          'bookingPassword'
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
    if (prop.credentials && Array.isArray(prop.credentials)) {
      result.credentials = (prop.credentials as any[]).map((cred: any) => {
        const masked: any = { ...cred }
        if (cred.expediaPassword) masked.expediaPassword = MASK
        if (cred.agodaPassword) masked.agodaPassword = MASK
        if (cred.bookingPassword) masked.bookingPassword = MASK
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
      webmail_password,
      ...propertyData
    } = data

    const encryptedData: any = { ...propertyData }
    if (qp_username !== undefined) encryptedData.qp_username = qp_username
    if (qp_password)
      encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key)
      encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
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

        return {
          propertyName,
          portfolioName,
          propertyAddress: r['Property Address']
            ? String(r['Property Address']).trim()
            : undefined,
          cardDescriptor: r['Card Descriptor']
            ? String(r['Card Descriptor']).trim()
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
          newDomainsEmail: r['New Domains Email']
            ? String(r['New Domains Email']).trim()
            : undefined,
          webmailPassword: encryptPassword(r['Webmail Password'])
        } satisfies ImportPropertyRow
      })
      .filter(Boolean) as ImportPropertyRow[]

    const result = await this.repo.importProperties(rows)
    await this.redisService.deleteByPattern(ALL_PATTERN)
    return result
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
      `[MANUAL CACHE REFRESH] Clearing all property cache keys (requested by user: ${user.id})`
    )

    // Delete all property cache keys (all users and individual items)
    await this.redisService.deleteByPattern(ALL_PATTERN)
    await this.redisService.deleteByPattern('property:*')

    this.logger.log(
      `[MANUAL CACHE REFRESH] Successfully cleared all property cache keys`
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
    })

    return {
      expedia_id: Array.from(uniqueExpediaIds).sort(),
      portfolio: Array.from(portfolioMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      property: Array.from(propertyMap.values()).sort((a, b) =>
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
      expedia_processor: Array.from(uniqueExpediaProcessors).sort(),
      booking_processor: Array.from(uniqueBookingProcessors).sort(),
      agoda_processor: Array.from(uniqueAgodaProcessors).sort(),
      fp_mid: Array.from(uniqueFpMids).sort(),
      stripe_account_email: Array.from(uniqueStripeAccountEmails).sort(),
      from: Array.from(uniqueFromDates).sort(),
      to: Array.from(uniqueToDates).sort()
    }
  }

  private hashQuery(query: object): string {
    return createHash('sha256')
      .update(JSON.stringify(query))
      .digest('hex')
      .substring(0, 16)
  }
}
