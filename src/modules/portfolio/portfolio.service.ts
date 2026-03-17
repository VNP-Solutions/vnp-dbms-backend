import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import * as XLSX from 'xlsx'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'
import type {
  IPortfolioRepository,
  IPortfolioService,
  ImportPortfoliosResult,
  PortfolioWithCounts
} from './portfolio.interface'

@Injectable()
export class PortfolioService implements IPortfolioService {
  private readonly logger = new Logger(PortfolioService.name)

  constructor(
    @Inject('IPortfolioRepository')
    private readonly portfolioRepository: IPortfolioRepository,
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreatePortfolioDto, _user: IUserWithPermissions) {
    const existing = await this.portfolioRepository.findByName(data.name)
    if (existing) throw new ConflictException('Portfolio with this name already exists')
    if (data.is_commissionable && !data.sales_agent) {
      throw new BadRequestException('Sales agent is required when portfolio is commissionable')
    }
    return this.portfolioRepository.create(data)
  }

  async findAll(query: PortfolioQueryDto, user: IUserWithPermissions) {
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
      nestedFieldMap: { service_type_name: 'serviceType.type' }
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
    const portfolio = await this.portfolioRepository.findById(id)
    if (!portfolio) throw new NotFoundException('Portfolio not found')
    return portfolio
  }

  async update(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions) {
    const existing = await this.findOne(id, user)
    if (!existing) {
      throw new NotFoundException('Portfolio not found')
    }
    return this.portfolioRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions) {
    const _portfolio = await this.findOne(id, user)
    const count = await this.portfolioRepository.countProperties(id)
    if (count > 0) {
      throw new BadRequestException(
        `Cannot delete portfolio with ${count} associated properties. Delete or reassign properties first.`
      )
    }
    await this.portfolioRepository.delete(id)
    return { message: 'Portfolio deleted successfully' }
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

    const currencyCol = headers.find(
      (h) => h.toLowerCase() === 'currency' || h.toLowerCase() === 'currency code'
    ) || 'Currency'

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
        'No active Service Type found in system. Please configure it first.'
      )
    }

    let portfoliosCreated = 0
    const portfolios: any[] = []
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
      try {
        const existing = await this.portfolioRepository.findByName(name)
        if (existing) {
          this.logger.debug(`Portfolio "${name}" already exists, skipping`)
          continue
        }

        const row = data.find((r) => String((r as any)[portfolioCol]).trim() === name) as any

        let service_type_id = defaultServiceType.id
        let currency_id: string | undefined = defaultCurrency?.id

        if (row?.[serviceTypeCol]) {
          const st = await this.prisma.serviceType.findFirst({
            where: {
              OR: [
                { type: { equals: String(row[serviceTypeCol]).trim(), mode: 'insensitive' } },
                { id: String(row[serviceTypeCol]).trim() }
              ]
            }
          })
          if (st) service_type_id = st.id
        }

        if (row?.[currencyCol]) {
          const cur = await this.prisma.currency.findFirst({
            where: {
              OR: [
                { code: { equals: String(row[currencyCol]).trim(), mode: 'insensitive' } },
                { id: String(row[currencyCol]).trim() }
              ]
            }
          })
          if (cur) currency_id = cur.id
        }

        const is_active = row?.['Is Active'] !== undefined
          ? String(row['Is Active']).toLowerCase() === 'true' || row['Is Active'] === true
          : true
        const is_commissionable = row?.['Is Commissionable'] !== undefined
          ? String(row['Is Commissionable']).toLowerCase() === 'true' || row['Is Commissionable'] === true
          : false

        const dto: CreatePortfolioDto = {
          name,
          service_type_id,
          currency_id,
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
          sales_agent: row?.['Sales Agent'] ? String(row['Sales Agent']).trim() : undefined,
          access_email: row?.['Access Email'] ? String(row['Access Email']).trim() : undefined,
          access_phone: row?.['Access Phone'] ? String(row['Access Phone']).trim() : undefined,
          attachment: row?.['Attachment'] ? String(row['Attachment']).trim() : undefined,
          contract_signed:
            row?.['Contract Signed'] !== undefined
              ? String(row['Contract Signed']).toLowerCase() === 'true' || row['Contract Signed'] === true
              : undefined
        }

        if (is_commissionable && !dto.sales_agent) {
          dto.sales_agent = name
        }

        const created = await this.portfolioRepository.create(dto)
        portfolios.push(created)
        portfoliosCreated++
        this.logger.log(`Created portfolio: ${name}`)
      } catch (err: any) {
        this.logger.error(`Error creating portfolio "${name}": ${err.message}`)
        throw err
      }
    }

    return { portfoliosCreated, portfolios }
  }
}
