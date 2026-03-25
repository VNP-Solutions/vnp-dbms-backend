import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto'
import type {
  ImportPropertiesResult,
  ImportPropertyRow,
  IPropertyRepository,
  PropertyWithRelations
} from './property.interface'

const propertyInclude = {
  portfolio: { select: { id: true, name: true } },
  subportfolio: { select: { id: true, name: true } },
  credentials: true
}

@Injectable()
export class PropertyRepository implements IPropertyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getAccessiblePropertyIds(userId: string): Promise<string[] | 'all'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { property_permission: true } } }
    })
    const perm = user?.role?.property_permission
    if (!perm) return []
    if (perm.access_level === 'all') return 'all'

    const perms = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId },
      select: { property_id: true, portfolio_id: true, subportfolio_id: true }
    })

    const propertyIds = new Set<string>()
    for (const p of perms) {
      if (p.property_id) propertyIds.add(p.property_id)
      if (p.portfolio_id) {
        const props = await this.prisma.property.findMany({
          where: { portfolio_id: p.portfolio_id },
          select: { id: true }
        })
        props.forEach((x) => propertyIds.add(x.id))
      }
      if (p.subportfolio_id) {
        const props = await this.prisma.property.findMany({
          where: { subportfolio_id: p.subportfolio_id },
          select: { id: true }
        })
        props.forEach((x) => propertyIds.add(x.id))
      }
    }
    return Array.from(propertyIds)
  }

  async create(data: CreatePropertyDto): Promise<PropertyWithRelations> {
    const payload: any = {
      name: data.name,
      portfolio_id: data.portfolio_id,
      card_descriptor: data.card_descriptor,
      is_active: data.is_active ?? true,
      next_due_date: data.next_due_date ? new Date(data.next_due_date) : undefined,
      previous_portfolio_id: data.previous_portfolio_id,
      show_in_portfolio: data.show_in_portfolio ?? [],
      new_domain_email: data.new_domain_email,
      others_case_emails: data.others_case_emails ?? [],
      primary_case_email: data.primary_case_email,
      portfolio_contact_email: data.portfolio_contact_email,
      webmail_password: data.webmail_password,
      description: data.description,
      hotel_address: data.hotel_address,
      qp_username: data.qp_username,
      qp_password: data.qp_password,
      qp_api_key: data.qp_api_key,
      expedia_id: data.expedia_id,
      expedia_status: data.expedia_status,
      booking_id: data.booking_id,
      booking_status: data.booking_status,
      agoda_id: data.agoda_id,
      agoda_status: data.agoda_status
    }
    if (data.subportfolio_id) payload.subportfolio_id = data.subportfolio_id

    return this.prisma.property.create({
      data: payload,
      include: propertyInclude
    }) as Promise<PropertyWithRelations>
  }

  async findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PropertyWithRelations[]> {
    const { where, skip, take, orderBy } = queryOptions
    return this.prisma.property.findMany({
      where,
      skip,
      take,
      orderBy,
      include: propertyInclude
    }) as Promise<PropertyWithRelations[]>
  }

  async count(where: any): Promise<number> {
    return this.prisma.property.count({ where })
  }

  async findById(id: string): Promise<PropertyWithRelations | null> {
    return this.prisma.property.findUnique({
      where: { id },
      include: propertyInclude
    }) as Promise<PropertyWithRelations | null>
  }

  async findByName(name: string) {
    return this.prisma.property.findUnique({ where: { name } })
  }

  async update(id: string, data: UpdatePropertyDto): Promise<PropertyWithRelations> {
    const payload: any = { ...data }
    if (data.next_due_date !== undefined) payload.next_due_date = data.next_due_date ? new Date(data.next_due_date) : null
    if (data.is_active !== undefined) payload.is_active = data.is_active
    return this.prisma.property.update({
      where: { id },
      data: payload,
      include: propertyInclude
    }) as Promise<PropertyWithRelations>
  }

  async delete(id: string) {
    return this.prisma.property.delete({ where: { id } })
  }

  async findByPortfolioId(portfolioId: string): Promise<PropertyWithRelations[]> {
    return this.prisma.property.findMany({
      where: {
        OR: [
          { portfolio_id: portfolioId },
          { subportfolio: { portfolio_id: portfolioId } }
        ]
      },
      include: propertyInclude
    }) as Promise<PropertyWithRelations[]>
  }

  async findBySubportfolioId(subportfolioId: string): Promise<PropertyWithRelations[]> {
    return this.prisma.property.findMany({
      where: { subportfolio_id: subportfolioId },
      include: propertyInclude
    }) as Promise<PropertyWithRelations[]>
  }

  async getDropdownPortfoliosAndSubportfolios(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: { select: { portfolio_permission: true, property_permission: true } } }
    })
    const portfolioPerm = user?.role?.portfolio_permission
    const propertyPerm = user?.role?.property_permission
    const hasAllPortfolios = portfolioPerm?.access_level === 'all'
    const hasAllProperties = propertyPerm?.access_level === 'all'

    if (hasAllPortfolios && hasAllProperties) {
      const [portfolios, subportfolios] = await Promise.all([
        this.prisma.portfolio.findMany({ select: { id: true, name: true } }),
        this.prisma.subportfolio.findMany({ select: { id: true, name: true, portfolio_id: true } })
      ])
      return { portfolios, subportfolios }
    }

    const perms = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId },
      select: { portfolio_id: true, subportfolio_id: true }
    })
    const portfolioIds = [...new Set(perms.map((p) => p.portfolio_id).filter(Boolean))] as string[]
    const subportfolioIds = [...new Set(perms.map((p) => p.subportfolio_id).filter(Boolean))] as string[]

    const [portfolios, subportfolios] = await Promise.all([
      portfolioIds.length
        ? this.prisma.portfolio.findMany({
            where: { id: { in: portfolioIds } },
            select: { id: true, name: true }
          })
        : [],
      subportfolioIds.length
        ? this.prisma.subportfolio.findMany({
            where: { OR: [{ id: { in: subportfolioIds } }, { portfolio_id: { in: portfolioIds } }] },
            select: { id: true, name: true, portfolio_id: true }
          })
        : this.prisma.subportfolio.findMany({
            where: { portfolio_id: { in: portfolioIds } },
            select: { id: true, name: true, portfolio_id: true }
          })
    ])

    return {
      portfolios,
      subportfolios: subportfolios.filter(
        (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i
      )
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Import helpers — all DB access for the bulk property-import flow
  // live here, following the vnp-parser-backend thin-service convention.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the ID of the first active ServiceType (ordered by `order` asc).
   * Used as a fallback when creating portfolios during import.
   */
  async findDefaultServiceTypeId(): Promise<string | null> {
    const st = await this.prisma.serviceType.findFirst({
      where: { is_active: true },
      orderBy: { order: 'asc' },
      select: { id: true }
    })
    return st?.id ?? null
  }

  /**
   * Finds a portfolio by name; creates it if absent.
   * `defaultServiceTypeId` is used only when creating a new portfolio.
   */
  async findOrCreatePortfolio(
    name: string,
    defaultServiceTypeId: string
  ): Promise<{ id: string; name: string }> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { name },
      select: { id: true, name: true }
    })
    if (existing) return existing

    return this.prisma.portfolio.create({
      data: {
        name,
        service_type_id: defaultServiceTypeId,
        is_active: true,
        is_commissionable: false
      },
      select: { id: true, name: true }
    })
  }

  /**
   * Finds a subportfolio by name + portfolioId; creates it if absent.
   * On a Prisma unique constraint error (P2002) falls back to a lookup.
   */
  async findOrCreateSubportfolio(
    name: string,
    portfolioId: string
  ): Promise<{ id: string; name: string; portfolio_id: string }> {
    const existing = await this.prisma.subportfolio.findFirst({
      where: { name, portfolio_id: portfolioId },
      select: { id: true, name: true, portfolio_id: true }
    })
    if (existing) return existing

    try {
      return await this.prisma.subportfolio.create({
        data: { name, portfolio_id: portfolioId, description: null },
        select: { id: true, name: true, portfolio_id: true }
      })
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Name is globally unique in this schema — reuse whichever exists
        const fallback = await this.prisma.subportfolio.findUnique({
          where: { name },
          select: { id: true, name: true, portfolio_id: true }
        })
        if (fallback) return fallback
      }
      throw err
    }
  }

  /** Returns the oldest portfolio in the system (used as last-resort fallback). */
  async findFirstPortfolio(): Promise<{ id: string; name: string } | null> {
    return this.prisma.portfolio.findFirst({
      orderBy: { created_at: 'asc' },
      select: { id: true, name: true }
    })
  }

  /**
   * Bulk-imports properties from pre-parsed, typed rows.
   *
   * Phases (mirrors the parser-backend convention):
   *  1. Resolve / create portfolios
   *  2. Resolve / create subportfolios
   *  3. Create properties (skip duplicates, merge credentials on existing)
   *  4. Create / update credentials for each property
   *
   * All Prisma calls are consolidated here so the service stays thin.
   * Credential passwords arrive already encrypted from the service layer.
   */
  async importProperties(rows: ImportPropertyRow[]): Promise<ImportPropertiesResult> {
    const logger = new Logger(PropertyRepository.name)

    let portfoliosCreated = 0
    let subportfoliosCreated = 0
    let propertiesCreated = 0
    let credentialsCreated = 0
    const portfolios: Map<string, { id: string; name: string }> = new Map()
    const subportfolios: Map<string, { id: string; name: string; portfolio_id: string }> = new Map()
    const createdProperties: any[] = []

    // ── 1. Resolve default ServiceType once ───────────────────────────────
    const defaultServiceTypeId = await this.findDefaultServiceTypeId()
    if (!defaultServiceTypeId) {
      throw new Error('No active ServiceType found. Configure one before importing.')
    }

    // ── 2. Collect unique portfolio names and resolve/create ───────────────
    const uniquePortfolioNames = [...new Set(rows.map((r) => r.portfolioName).filter(Boolean))] as string[]
    for (const name of uniquePortfolioNames) {
      const before = await this.prisma.portfolio.count({ where: { name } })
      const portfolio = await this.findOrCreatePortfolio(name, defaultServiceTypeId)
      portfolios.set(name, portfolio)
      if (before === 0) {
        portfoliosCreated++
        logger.log(`Portfolio "${name}" created`)
      } else {
        logger.debug(`Portfolio "${name}" already exists, reusing`)
      }
    }

    // ── 3. Collect unique subportfolio combos and resolve/create ──────────
    const uniqueSubs = Array.from(
      new Map(
        rows
          .filter((r) => r.subPortfolioName && r.portfolioName)
          .map((r) => [`${r.portfolioName}::${r.subPortfolioName}`, r])
      ).values()
    )

    for (const row of uniqueSubs) {
      const portfolio = portfolios.get(row.portfolioName!)
      if (!portfolio) {
        logger.warn(`Portfolio "${row.portfolioName}" not in map for subportfolio "${row.subPortfolioName}", skipping`)
        continue
      }
      const key = `${row.portfolioName}::${row.subPortfolioName}`
      const before = await this.prisma.subportfolio.count({
        where: { name: row.subPortfolioName!, portfolio_id: portfolio.id }
      })
      const sub = await this.findOrCreateSubportfolio(row.subPortfolioName!, portfolio.id)
      subportfolios.set(key, sub)
      if (before === 0) {
        subportfoliosCreated++
        logger.log(`Subportfolio "${row.subPortfolioName}" created under "${row.portfolioName}"`)
      }
    }

    // ── 4. Process each property row ───────────────────────────────────────
    for (const row of rows) {
      const { propertyName, portfolioName, subPortfolioName, credentials } = row

      // Resolve portfolio id
      let portfolioId: string
      if (portfolioName) {
        const p = portfolios.get(portfolioName)
        if (!p) {
          logger.warn(`Portfolio "${portfolioName}" not resolved for property "${propertyName}", skipping`)
          continue
        }
        portfolioId = p.id
      } else {
        const first = await this.findFirstPortfolio()
        if (!first) {
          logger.warn(`No portfolio in system, cannot create property "${propertyName}", skipping`)
          continue
        }
        portfolioId = first.id
      }

      // Resolve subportfolio id
      let subportfolioId: string | undefined
      if (subPortfolioName && portfolioName) {
        const s = subportfolios.get(`${portfolioName}::${subPortfolioName}`)
        if (s) subportfolioId = s.id
      }

      // Duplicate check
      const existingProp = await this.findByName(propertyName)
      if (existingProp) {
        logger.debug(`Property "${propertyName}" already exists — merging credentials if any`)
        if (credentials && Object.keys(credentials).length > 0) {
          try {
            const existingCreds = await this.prisma.propertyCredentials.findFirst({
              where: { property_id: existingProp.id }
            })
            const credPayload = { ...credentials }
            if (existingCreds) {
              await this.prisma.propertyCredentials.update({
                where: { id: existingCreds.id },
                data: credPayload
              })
            } else {
              await this.prisma.propertyCredentials.create({
                data: { property_id: existingProp.id, ...credPayload }
              })
            }
            credentialsCreated++
          } catch (err: any) {
            logger.error(`Error merging credentials for "${propertyName}": ${err.message}`)
          }
        }
        continue
      }

      // Build create payload
      const propertyPayload: any = {
        name: propertyName,
        portfolio_id: portfolioId,
        is_active: row.isActive ?? true,
        expedia_status: row.expediaStatus || 'Access Required',
        booking_status: row.bookingStatus || 'Access Required',
        agoda_status: row.agodaStatus || 'Access Required'
      }
      if (subportfolioId) propertyPayload.subportfolio_id = subportfolioId
      if (row.expediaId != null) propertyPayload.expedia_id = row.expediaId
      if (row.bookingId != null) propertyPayload.booking_id = row.bookingId
      if (row.agodaId != null) propertyPayload.agoda_id = row.agodaId
      if (row.webmailPassword) propertyPayload.webmail_password = row.webmailPassword

      try {
        const created = await this.prisma.property.create({
          data: propertyPayload,
          include: {
            portfolio: { select: { id: true, name: true } },
            subportfolio: { select: { id: true, name: true } }
          }
        })
        createdProperties.push(created)
        propertiesCreated++
        logger.log(`Property "${propertyName}" created`)

        if (credentials && Object.keys(credentials).length > 0) {
          await this.prisma.propertyCredentials.create({
            data: { property_id: created.id, ...credentials }
          })
          credentialsCreated++
        }
      } catch (err: any) {
        logger.error(`Error creating property "${propertyName}": ${err.message}`)
        throw err
      }
    }

    return {
      portfoliosCreated,
      subportfoliosCreated,
      propertiesCreated,
      credentialsCreated,
      portfolios: [...portfolios.values()],
      subportfolios: [...subportfolios.values()],
      properties: createdProperties
    }
  }
}
