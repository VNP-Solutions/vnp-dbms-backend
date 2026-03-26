import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IAuthRepository } from '../auth/auth.interface'
import { PrismaService } from '../prisma/prisma.service'
import type { IPropertyCredentialsService } from '../property-credentials/property-credentials.interface'
import {
  CreatePropertyDto,
  GetPropertyCredentialDto,
  PropertyQueryDto,
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
    private readonly encryptionUtil: EncryptionUtil,
    private readonly prisma: PrismaService
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

    return this.repo.findById(property.id) as Promise<PropertyWithRelations>
  }

  async findAll(query: PropertyQueryDto, user: IUserWithPermissions) {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
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
    if (query.name)
      additionalFilters.name = { contains: query.name, mode: 'insensitive' }
    if (query.subportfolio_id)
      additionalFilters.subportfolio_id = query.subportfolio_id
    if (query.previous_portfolio_id)
      additionalFilters.previous_portfolio_id = query.previous_portfolio_id
    if (query.card_descriptor)
      additionalFilters.card_descriptor = { contains: query.card_descriptor, mode: 'insensitive' }
    if (query.next_due_date)
      additionalFilters.next_due_date = new Date(query.next_due_date)
    if (query.new_domain_email)
      additionalFilters.new_domain_email = { contains: query.new_domain_email, mode: 'insensitive' }
    if (query.primary_case_email)
      additionalFilters.primary_case_email = { contains: query.primary_case_email, mode: 'insensitive' }
    if (query.portfolio_contact_email)
      additionalFilters.portfolio_contact_email = { contains: query.portfolio_contact_email, mode: 'insensitive' }
    if (query.description)
      additionalFilters.description = { contains: query.description, mode: 'insensitive' }
    if (query.hotel_address)
      additionalFilters.hotel_address = { contains: query.hotel_address, mode: 'insensitive' }
    if (query.qp_username)
      additionalFilters.qp_username = { contains: query.qp_username, mode: 'insensitive' }
    if (query.expedia_id) additionalFilters.expedia_id = query.expedia_id
    if (query.expedia_status)
      additionalFilters.expedia_status = query.expedia_status
    if (query.booking_id) additionalFilters.booking_id = query.booking_id
    if (query.booking_status)
      additionalFilters.booking_status = query.booking_status
    if (query.agoda_id) additionalFilters.agoda_id = query.agoda_id
    if (query.agoda_status) additionalFilters.agoda_status = query.agoda_status
    if (query.is_active !== undefined && query.is_active !== 'All') {
      additionalFilters.is_active = query.is_active
    }
    if (query.start_date && query.end_date) {
      const startDate = new Date(query.start_date)
      startDate.setHours(0, 0, 0, 0)
      
      const endDate = new Date(query.end_date)
      endDate.setHours(23, 59, 59, 999)
      
      additionalFilters.created_at = {
        gte: startDate,
        lte: endDate
      }
      
      this.logger.debug(`Date filter applied: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    }

    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    this.logger.debug(`Merged query filters: ${JSON.stringify(mergedQuery.filters, null, 2)}`)

    const queryConfig = {
      searchFields: ['name', 'description', 'hotel_address'],
      filterableFields: [
        'name',
        'subportfolio_id',
        'previous_portfolio_id',
        'card_descriptor',
        'next_due_date',
        'new_domain_email',
        'primary_case_email',
        'portfolio_contact_email',
        'description',
        'hotel_address',
        'qp_username',
        'is_active',
        'created_at',
        'expedia_id',
        'expedia_status',
        'booking_id',
        'booking_status',
        'agoda_id',
        'agoda_status'
      ],
      sortableFields: [
        'name',
        'created_at',
        'updated_at',
        'is_active',
        'next_due_date'
      ],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        subportfolio_name: 'subportfolio.name',
        currency_code: 'currency.code'
      }
    }

    const baseWhere: any =
      accessibleIds === 'all' ? {} : { id: { in: accessibleIds } }

    const {
      where: builtWhere,
      skip,
      take,
      orderBy,
      usePagination
    } = QueryBuilder.buildPrismaQuery(mergedQuery, queryConfig, baseWhere)

    let where = builtWhere
    if (query.portfolio_id) {
      const portfolioCondition = {
        OR: [
          { portfolio_id: query.portfolio_id },
          { subportfolio: { portfolio_id: query.portfolio_id } }
        ]
      }
      where =
        Object.keys(builtWhere).length === 0
          ? portfolioCondition
          : { AND: [builtWhere, portfolioCondition] }
    }

    if (query.portfolio_name) {
      const portfolioNameCondition = {
        OR: [
          { portfolio: { name: { contains: query.portfolio_name, mode: 'insensitive' } } },
          { subportfolio: { portfolio: { name: { contains: query.portfolio_name, mode: 'insensitive' } } } }
        ]
      }
      where =
        Object.keys(where).length === 0
          ? portfolioNameCondition
          : { AND: [where, portfolioNameCondition] }
    }

    this.logger.debug(`Final where clause: ${JSON.stringify(where, null, 2)}`)

    const [data, total] = await Promise.all([
      this.repo.findAll({ where, skip, take, orderBy }),
      this.repo.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? query.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

    this.logger.debug(`masked value: ${JSON.stringify(query.masked)}, type: ${typeof query.masked}`)

    const shouldDecrypt = query.masked === false
    this.logger.debug(`shouldDecrypt: ${shouldDecrypt}`)

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

    // If masked is true or undefined, replace encrypted values with asterisks
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
    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')
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

    return this.repo.findById(id) as Promise<PropertyWithRelations>
  }

  async remove(id: string, user: IUserWithPermissions) {
    await this.findOne(id, user)
    await this.repo.delete(id)
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
  importFromExcel(
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
    if (!headers.some(h => h.toLowerCase() === 'property name' || h.toLowerCase() === 'property')) {
      throw new BadRequestException('Excel must contain "Property Name" column')
    }
    if (!headers.some(h => h.toLowerCase() === 'portfolio')) {
      throw new BadRequestException('Excel must contain "Portfolio" column')
    }

    this.logger.log(`Parsing ${rawRows.length} rows for property import`)

    // Map rows to ImportPropertyRow with encryption
    const rows: ImportPropertyRow[] = rawRows
      .map((r) => {
        const propertyName = r['Property Name'] ? String(r['Property Name']).trim() : ''
        if (!propertyName) return null

        const portfolioName = r['Portfolio'] ? String(r['Portfolio']).trim() : ''
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
          propertyAddress: r['Property Address'] ? String(r['Property Address']).trim() : undefined,
          cardDescriptor: r['Card Descriptor'] ? String(r['Card Descriptor']).trim() : undefined,
          expediaId: r['Expedia ID'] ? String(r['Expedia ID']).trim() : undefined,
          agodaId: r['Agoda ID'] ? String(r['Agoda ID']).trim() : undefined,
          bookingId: r['Booking ID'] ? String(r['Booking ID']).trim() : undefined,
          expediaUsername: r['Expedia Username'] ? String(r['Expedia Username']).trim() : undefined,
          agodaUsername: r['Agoda Username'] ? String(r['Agoda Username']).trim() : undefined,
          bookingUsername: r['Booking Username'] ? String(r['Booking Username']).trim() : undefined,
          expediaPassword: encryptPassword(r['Expedia Password']),
          bookingPassword: encryptPassword(r['Booking Password']),
          agodaPassword: encryptPassword(r['Agoda Password']),
          portfolioContactEmail: r['Portfolio Contact Email'] ? String(r['Portfolio Contact Email']).trim() : undefined,
          caseContactEmail: r['Case Contact Email'] ? String(r['Case Contact Email']).trim() : undefined,
          qpUsername: r['Qp Username'] ? String(r['Qp Username']).trim() : undefined,
          qpPassword: encryptPassword(r['Qp Password']),
          qpApiKey: encryptPassword(r['Qp Api Key']),
          newDomainsEmail: r['New Domains Email'] ? String(r['New Domains Email']).trim() : undefined,
          webmailPassword: encryptPassword(r['Webmail Password'])
        } satisfies ImportPropertyRow
      })
      .filter(Boolean) as ImportPropertyRow[]

    return this.repo.importProperties(rows)
  }

  async bulkDelete(ids: string[], user: IUserWithPermissions): Promise<import('./property.interface').BulkDeleteResult> {
    this.logger.log(`User ${user.email} attempting to bulk delete ${ids.length} properties`)

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

    this.logger.log(`Bulk delete completed: ${success.length} success, ${skipped.length} skipped`)

    return {
      success,
      skipped,
      totalProcessed: ids.length,
      successCount: success.length,
      skippedCount: skipped.length
    }
  }
}
