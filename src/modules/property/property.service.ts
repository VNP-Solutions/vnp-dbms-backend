import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IPropertyCredentialsService } from '../property-credentials/property-credentials.interface'
import { CreatePropertyDto, PropertyQueryDto, UpdatePropertyDto } from './property.dto'
import type { IPropertyRepository, IPropertyService, PropertyWithRelations } from './property.interface'

@Injectable()
export class PropertyService implements IPropertyService {
  constructor(
    @Inject('IPropertyRepository')
    private readonly repo: IPropertyRepository,
    @Inject('IPropertyCredentialsService')
    private readonly credentialsService: IPropertyCredentialsService,
    private readonly encryptionUtil: EncryptionUtil
  ) {}

  async create(data: CreatePropertyDto, _user: IUserWithPermissions): Promise<PropertyWithRelations> {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Property with this name already exists')
    
    const { credentials, qp_username, qp_password, qp_api_key, ...propertyData } = data
    
    const encryptedData: any = { ...propertyData }
    if (qp_username) encryptedData.qp_username = qp_username
    if (qp_password) encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key) encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
    
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
      return {
        data: [],
        metadata: { totalDocuments: 0, currentPage: query.page || 1, totalPages: 0 }
      }
    }

    const additionalFilters: any = {}
    if (query.subportfolio_id) additionalFilters.subportfolio_id = query.subportfolio_id
    if (query.currency_id) additionalFilters.currency_id = query.currency_id
    if (query.expedia_id) additionalFilters.expedia_id = query.expedia_id
    if (query.expedia_status) additionalFilters.expedia_status = query.expedia_status
    if (query.booking_id) additionalFilters.booking_id = query.booking_id
    if (query.booking_status) additionalFilters.booking_status = query.booking_status
    if (query.agoda_id) additionalFilters.agoda_id = query.agoda_id
    if (query.agoda_status) additionalFilters.agoda_status = query.agoda_status
    if (query.is_active !== undefined && query.is_active !== '') {
      const v = (query.is_active || '').toLowerCase().trim()
      if (v === 'all') {
        // no filter
      } else if (v === 'true') additionalFilters.is_active = true
      else if (v === 'false') additionalFilters.is_active = false
      else additionalFilters.is_active = true
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
      sortableFields: ['name', 'created_at', 'updated_at', 'is_active', 'next_due_date'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        subportfolio_name: 'subportfolio.name',
        currency_code: 'currency.code'
      }
    }

    const baseWhere: any =
      accessibleIds === 'all'
        ? {}
        : { id: { in: accessibleIds } }

    const { where: builtWhere, skip, take, orderBy } = QueryBuilder.buildPrismaQuery(
      mergedQuery,
      queryConfig,
      baseWhere
    )

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

  async findOne(id: string, user: IUserWithPermissions): Promise<PropertyWithRelations> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    if (Array.isArray(accessibleIds) && !accessibleIds.includes(id)) {
      throw new NotFoundException('Property not found')
    }
    const property = await this.repo.findById(id)
    if (!property) throw new NotFoundException('Property not found')
    return property
  }

  async update(id: string, data: UpdatePropertyDto, user: IUserWithPermissions): Promise<PropertyWithRelations> {
    await this.findOne(id, user)
    if (data.name) {
      const existing = await this.repo.findByName(data.name)
      if (existing && existing.id !== id) {
        throw new ConflictException('Property with this name already exists')
      }
    }

    const { credentials, qp_username, qp_password, qp_api_key, ...propertyData } = data
    
    const encryptedData: any = { ...propertyData }
    if (qp_username !== undefined) encryptedData.qp_username = qp_username
    if (qp_password) encryptedData.qp_password = this.encryptionUtil.encrypt(qp_password)
    if (qp_api_key) encryptedData.qp_api_key = this.encryptionUtil.encrypt(qp_api_key)
    
    await this.repo.update(id, encryptedData)

    if (credentials && Object.keys(credentials).length > 0) {
      const existingCredentials = await this.credentialsService.findByPropertyId(id)
      
      if (existingCredentials) {
        await this.credentialsService.update(existingCredentials.id, credentials)
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

  async findByPortfolioId(portfolioId: string, user: IUserWithPermissions): Promise<PropertyWithRelations[]> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    const list = await this.repo.findByPortfolioId(portfolioId)
    if (accessibleIds === 'all') return list
    const idSet = new Set(accessibleIds)
    return list.filter((p) => idSet.has(p.id))
  }

  async findBySubportfolioId(subportfolioId: string, user: IUserWithPermissions): Promise<PropertyWithRelations[]> {
    const accessibleIds = await this.repo.getAccessiblePropertyIds(user.id)
    const list = await this.repo.findBySubportfolioId(subportfolioId)
    if (accessibleIds === 'all') return list
    const idSet = new Set(accessibleIds)
    return list.filter((p) => idSet.has(p.id))
  }

  async getDropdown(user: IUserWithPermissions) {
    return this.repo.getDropdownPortfoliosAndSubportfolios(user.id)
  }
}
