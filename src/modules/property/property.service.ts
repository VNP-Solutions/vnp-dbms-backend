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
  IPropertyRepository,
  IPropertyService,
  ImportPropertiesResult,
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
    if (query.subportfolio_id)
      additionalFilters.subportfolio_id = query.subportfolio_id
    if (query.currency_id) additionalFilters.currency_id = query.currency_id
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
      searchFields: ['name', 'address', 'description', 'hotel_address'],
      filterableFields: [
        'subportfolio_id',
        'currency_id',
        'is_active',
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

    const [data, total] = await Promise.all([
      this.repo.findAll({ where, skip, take, orderBy }),
      this.repo.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? query.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

    // Debug: Log the masked value
    this.logger.debug(`masked value: ${JSON.stringify(query.masked)}, type: ${typeof query.masked}`)

    // If masked=false, return decrypted credentials. Default (masked true or not provided) = encrypted/masked.
    const shouldDecrypt = query.masked === false
    this.logger.debug(`shouldDecrypt: ${shouldDecrypt}`)
    
    if (shouldDecrypt) {
      // FEATURE (commented): When masked=false, validate user_name and user_password before returning decrypted data.
      // Uncomment the block below to enable credential validation for unmasked requests.
      /*
      if (!query.user_name || !query.user_password) {
        throw new BadRequestException(
          'user_name and user_password are required when requesting unmasked credentials'
        )
      }
      const authUser = await this.authRepository.findUserByEmail(query.user_name)
      if (!authUser) {
        throw new BadRequestException('Invalid user_name or user_password')
      }
      if (authUser.temp_password) {
        throw new BadRequestException('Invalid user_name or user_password')
      }
      const isPasswordValid = await EncryptionUtil.comparePassword(
        query.user_password,
        authUser.password
      )
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid user_name or user_password')
      }
      */

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
    const data = XLSX.utils.sheet_to_json(worksheet)

    if (!data || data.length === 0) {
      throw new BadRequestException('Excel file is empty or invalid')
    }

    const headers = Object.keys(data[0] as object)
    const propertyNameCol =
      headers.find(
        h =>
          h.toLowerCase() === 'property name' || h.toLowerCase() === 'property'
      ) || 'Property Name'
    if (!headers.includes(propertyNameCol)) {
      throw new BadRequestException(
        'Excel must contain "Property Name" or "Property" column'
      )
    }

    const addressCol =
      headers.find(h => h.toLowerCase() === 'address') || 'Address'
    const portfolioCol =
      headers.find(h => h.toLowerCase() === 'portfolio') || 'Portfolio'
    const subPortfolioCol =
      headers.find(h =>
        ['sub portfolio', 'subportfolio'].includes(h.toLowerCase())
      ) || 'Sub Portfolio'
    const currencyCol =
      headers.find(h => h.toLowerCase() === 'currency') || 'Currency'

    const defaultServiceType = await this.prisma.serviceType.findFirst({
      where: { is_active: true },
      orderBy: { order: 'asc' }
    })
    const defaultCurrency = await this.prisma.currency.findFirst({
      where: { is_active: true },
      orderBy: { order: 'asc' }
    })

    if (!defaultServiceType) {
      throw new BadRequestException(
        'No active Service Type found. Please configure it first.'
      )
    }

    let portfoliosCreated = 0
    let subportfoliosCreated = 0
    let propertiesCreated = 0
    let credentialsCreated = 0
    const portfolios: any[] = []
    const subportfolios: any[] = []
    const properties: any[] = []

    if (headers.includes(portfolioCol)) {
      const portfolioNames = [
        ...new Set(
          data
            .map(r => {
              const v = (r as any)[portfolioCol]
              return v && String(v).trim() ? String(v).trim() : null
            })
            .filter(Boolean)
        )
      ] as string[]

      for (const name of portfolioNames) {
        const existing = await this.prisma.portfolio.findUnique({
          where: { name }
        })
        if (existing) {
          portfolios.push(existing)
          continue
        }
        const created = await this.prisma.portfolio.create({
          data: {
            name,
            service_type_id: defaultServiceType.id,
            currency_id: defaultCurrency?.id,
            is_active: true,
            is_commissionable: false
          },
          include: { serviceType: true, currency: true }
        })
        portfolios.push(created)
        portfoliosCreated++
        this.logger.log(`Created portfolio: ${name}`)
      }
    }

    if (headers.includes(subPortfolioCol) && headers.includes(portfolioCol)) {
      const subData = data
        .map(r => ({
          subName: String((r as any)[subPortfolioCol] || '').trim(),
          portfolioName: String((r as any)[portfolioCol] || '').trim()
        }))
        .filter(x => x.subName && x.portfolioName)

      const uniqueSubs = Array.from(
        new Map(
          subData.map(x => [`${x.portfolioName}::${x.subName}`, x])
        ).values()
      )

      for (const { subName, portfolioName } of uniqueSubs) {
        const portfolio = portfolios.find(p => p.name === portfolioName)
        if (!portfolio) continue

        const existing = await this.prisma.subportfolio.findFirst({
          where: { name: subName, portfolio_id: portfolio.id }
        })
        if (existing) {
          subportfolios.push(existing)
          continue
        }

        try {
          const created = await this.prisma.subportfolio.create({
            data: {
              name: subName,
              portfolio_id: portfolio.id,
              description: null
            },
            include: { portfolio: true }
          })
          subportfolios.push(created)
          subportfoliosCreated++
          this.logger.log(
            `Created subportfolio: ${subName} under ${portfolioName}`
          )
        } catch (err: any) {
          if (err.code === 'P2002') {
            const existingByName = await this.prisma.subportfolio.findUnique({
              where: { name: subName }
            })
            if (existingByName) subportfolios.push(existingByName)
          } else throw err
        }
      }
    }

    for (const row of data) {
      const r = row as any
      const propertyName = r[propertyNameCol]
        ? String(r[propertyNameCol]).trim()
        : ''
      if (!propertyName) continue

      const address = r[addressCol]
        ? String(r[addressCol]).trim()
        : propertyName
      const portfolioName = r[portfolioCol]
        ? String(r[portfolioCol]).trim()
        : null
      const subPortfolioName = r[subPortfolioCol]
        ? String(r[subPortfolioCol]).trim()
        : null

      let portfolioId: string
      let subportfolioId: string | null = null

      if (portfolioName) {
        const portfolio = portfolios.find(p => p.name === portfolioName)
        if (!portfolio) {
          this.logger.warn(
            `Portfolio "${portfolioName}" not found for property "${propertyName}", skipping`
          )
          continue
        }
        portfolioId = portfolio.id

        if (subPortfolioName) {
          const sub = subportfolios.find(
            s => s.name === subPortfolioName && s.portfolio_id === portfolioId
          )
          if (sub) subportfolioId = sub.id
        }
      } else {
        const firstPortfolio = await this.prisma.portfolio.findFirst({
          orderBy: { created_at: 'asc' }
        })
        if (!firstPortfolio) {
          this.logger.warn(
            'No portfolio in system, cannot create property without portfolio'
          )
          continue
        }
        portfolioId = firstPortfolio.id
      }

      const existingProp = await this.repo.findByName(propertyName)
      if (existingProp) {
        this.logger.debug(
          `Property "${propertyName}" already exists, merging credentials if any`
        )
        const creds = this.buildCredentialsFromRow(r)
        if (creds && Object.keys(creds).length > 0) {
          try {
            const existingCreds =
              await this.credentialsService.findByPropertyId(existingProp.id)
            if (existingCreds) {
              await this.credentialsService.update(existingCreds.id, creds)
            } else {
              await this.credentialsService.create({
                ...creds,
                property_id: existingProp.id
              })
            }
            credentialsCreated++
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {
            // ignore
          }
        }
        continue
      }

      let currency_id: string | undefined = defaultCurrency?.id
      if (r[currencyCol]) {
        const found = await this.prisma.currency.findFirst({
          where: {
            OR: [
              {
                code: {
                  equals: String(r[currencyCol]).trim(),
                  mode: 'insensitive'
                }
              },
              { id: String(r[currencyCol]).trim() }
            ]
          }
        })
        if (found) currency_id = found.id
      }

      const propertyData: CreatePropertyDto = {
        name: propertyName,
        address,
        currency_id,
        portfolio_id: portfolioId,
        subportfolio_id: subportfolioId || undefined,
        is_active: true,
        expedia_status: r['Expedia Status'] || 'Access Required',
        booking_status: r['Booking Status'] || 'Access Required',
        agoda_status: r['Agoda Status'] || 'Access Required',
        expedia_id: r['Expedia ID'] ? Number(r['Expedia ID']) : undefined,
        booking_id: r['Booking ID'] ? Number(r['Booking ID']) : undefined,
        agoda_id: r['Agoda ID'] ? Number(r['Agoda ID']) : undefined,
        webmail_password: r['Webmail Password']
          ? String(r['Webmail Password']).trim()
          : undefined,
        credentials: this.buildCredentialsFromRow(r)
      }

      try {
        const created = await this.create(propertyData, _user)
        properties.push(created)
        propertiesCreated++
        if (
          propertyData.credentials &&
          Object.keys(propertyData.credentials).length > 0
        ) {
          credentialsCreated++
        }
        this.logger.log(`Created property: ${propertyName}`)
      } catch (err: any) {
        this.logger.error(
          `Error creating property "${propertyName}": ${err.message}`
        )
        throw err
      }
    }

    return {
      portfoliosCreated,
      subportfoliosCreated,
      propertiesCreated,
      credentialsCreated,
      portfolios,
      subportfolios,
      properties
    }
  }

  private buildCredentialsFromRow(r: any): Record<string, any> | undefined {
    const creds: Record<string, any> = {}
    const map: [string, string][] = [
      ['Expedia Username', 'expediaUsername'],
      ['Expedia Password', 'expediaPassword'],
      ['Agoda Username', 'agodaUsername'],
      ['Agoda Password', 'agodaPassword'],
      ['Booking Username', 'bookingUsername'],
      ['Booking Password', 'bookingPassword'],
      ['Expedia Email Associated', 'expediaEmailAssociated'],
      ['Property Contact Email', 'propertyContactEmail'],
      ['Portfolio Contact Email', 'portfolioContactEmail']
    ]
    for (const [col, key] of map) {
      if (r[col]) {
        const val = String(r[col]).trim()
        if (key.endsWith('Password') && val) {
          creds[key] = this.encryptionUtil.encrypt(val)
        } else {
          creds[key] = val
        }
      }
    }
    if (r['Multiple Portfolio Emails']) {
      const emails = String(r['Multiple Portfolio Emails'])
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
      if (emails.length) creds.multiplePortfolioEmails = emails
    }
    return Object.keys(creds).length > 0 ? creds : undefined
  }
}
