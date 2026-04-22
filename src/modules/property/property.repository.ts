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
  subportfolio: { select: { id: true, name: true, portfolio_id: true } },
  serviceType: { select: { id: true, type: true } },
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
      service_type_id: data.service_type_id,
      card_descriptor: data.card_descriptor,
      is_active: data.is_active ?? true,
      next_due_date: data.next_due_date ? new Date(data.next_due_date) : undefined,
      previous_portfolio_id: data.previous_portfolio_id,
      show_in_portfolio: data.show_in_portfolio ?? [],
      new_domain_email: data.new_domain_email,
      others_case_emails: data.others_case_emails ?? [],
      primary_case_email: data.primary_case_email,
      portfolio_contact_email: data.portfolio_contact_email,
      portfolio_contact: data.portfolio_contact,
      webmail_password: data.webmail_password,
      description: data.description,
      descriptor: data.descriptor,
      property_identifier: data.property_identifier,
      hotel_address: data.hotel_address,
      case_management_contact: data.case_management_contact,
      access_contact: data.access_contact,
      reporting_contact: data.reporting_contact,
      expedia_processor: data.expedia_processor,
      booking_processor: data.booking_processor,
      agoda_processor: data.agoda_processor,
      from: data.from,
      to: data.to,
      qp_username: data.qp_username,
      qp_password: data.qp_password,
      qp_api_key: data.qp_api_key,
      fp_mid: data.fp_mid,
      fp_username: data.fp_username,
      fp_password: data.fp_password,
      stripe_account_email: data.stripe_account_email,
      expedia_id: data.expedia_id,
      expedia_status: data.expedia_status,
      booking_id: data.booking_id,
      booking_status: data.booking_status,
      agoda_id: data.agoda_id,
      agoda_status: data.agoda_status,
      expedia_billing_type: data.expedia_billing_type,
      expedia_service_type: data.expedia_service_type,
      expedia_frequency: data.expedia_frequency,
      expedia_access_level: data.expedia_access_level,
      expedia_from: data.expedia_from,
      expedia_to: data.expedia_to,
      expedia_scheduler: data.expedia_scheduler,
      expedia_duration: data.expedia_duration,
      booking_billing_type: data.booking_billing_type,
      booking_service_type: data.booking_service_type,
      booking_frequency: data.booking_frequency,
      booking_access_level: data.booking_access_level,
      booking_from: data.booking_from,
      booking_to: data.booking_to,
      booking_scheduler: data.booking_scheduler,
      booking_duration: data.booking_duration,
      agoda_billing_type: data.agoda_billing_type,
      agoda_service_type: data.agoda_service_type,
      agoda_frequency: data.agoda_frequency,
      agoda_access_level: data.agoda_access_level,
      agoda_from: data.agoda_from,
      agoda_to: data.agoda_to,
      agoda_scheduler: data.agoda_scheduler,
      agoda_duration: data.agoda_duration
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

  /**
   * Bulk-imports properties from pre-parsed, typed rows.
   * Auto-creates portfolios if they don't exist.
   */
  async importProperties(rows: ImportPropertyRow[]): Promise<ImportPropertiesResult> {
    const logger = new Logger(PropertyRepository.name)

    let propertiesCreated = 0
    let credentialsCreated = 0
    let propertiesSkipped = 0
    const createdProperties: any[] = []
    const skippedProperties: Array<{ name: string; reason: string }> = []

    for (const row of rows) {
      const { propertyName, portfolioName } = row

      // Find or create portfolio by name
      let portfolio = await this.prisma.portfolio.findUnique({
        where: { name: portfolioName },
        select: { id: true, name: true }
      })

      if (!portfolio) {
        logger.log(`Portfolio "${portfolioName}" not found — creating it`)
        
        // Find or create default "OTA" ServiceType
        let defaultServiceType = await this.prisma.serviceType.findFirst({
          where: { type: { equals: 'OTA', mode: 'insensitive' } }
        })

        if (!defaultServiceType) {
          logger.log('Default "OTA" service type not found, creating it...')
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
          logger.log('Default "OTA" service type created successfully')
        }

        // Create the portfolio
        try {
          portfolio = await this.prisma.portfolio.create({
            data: {
              name: portfolioName,
              service_type_id: defaultServiceType.id,
              is_active: true,
              is_commissionable: false
            },
            select: { id: true, name: true }
          })
          logger.log(`Portfolio "${portfolioName}" created successfully`)
        } catch (err: any) {
          logger.error(`Error creating portfolio "${portfolioName}": ${err.message}`)
          skippedProperties.push({
            name: propertyName,
            reason: `Error creating portfolio: ${err.message}`
          })
          propertiesSkipped++
          continue
        }
      }

      // Check if property already exists
      const existingProp = await this.findByName(propertyName)
      if (existingProp) {
        logger.debug(`Property "${propertyName}" already exists, skipping`)
        skippedProperties.push({
          name: propertyName,
          reason: 'Property already exists'
        })
        propertiesSkipped++
        continue
      }

      // Build create payload
      const propertyPayload: any = {
        name: propertyName,
        portfolio_id: portfolio.id,
        is_active: true
      }

      if (row.propertyAddress) propertyPayload.hotel_address = row.propertyAddress
      if (row.cardDescriptor) propertyPayload.card_descriptor = row.cardDescriptor
      if (row.expediaId) propertyPayload.expedia_id = parseInt(row.expediaId) || undefined
      if (row.agodaId) propertyPayload.agoda_id = parseInt(row.agodaId) || undefined
      if (row.bookingId) propertyPayload.booking_id = parseInt(row.bookingId) || undefined
      if (row.portfolioContactEmail) propertyPayload.portfolio_contact_email = row.portfolioContactEmail
      if (row.newDomainsEmail) propertyPayload.new_domain_email = row.newDomainsEmail
      if (row.qpUsername) propertyPayload.qp_username = row.qpUsername
      if (row.qpPassword) propertyPayload.qp_password = row.qpPassword
      if (row.qpApiKey) propertyPayload.qp_api_key = row.qpApiKey
      if (row.webmailPassword) propertyPayload.webmail_password = row.webmailPassword
      if (row.expediaStatus) propertyPayload.expedia_status = row.expediaStatus
      if (row.bookingStatus) propertyPayload.booking_status = row.bookingStatus
      if (row.agodaStatus) propertyPayload.agoda_status = row.agodaStatus
      if (row.caseManagementContact) propertyPayload.case_management_contact = row.caseManagementContact
      if (row.accessContact) propertyPayload.access_contact = row.accessContact
      if (row.reportingContact) propertyPayload.reporting_contact = row.reportingContact
      if (row.expediaProcessor) propertyPayload.expedia_processor = row.expediaProcessor
      if (row.bookingProcessor) propertyPayload.booking_processor = row.bookingProcessor
      if (row.agodaProcessor) propertyPayload.agoda_processor = row.agodaProcessor
      if (row.from) propertyPayload.from = row.from
      if (row.to) propertyPayload.to = row.to
      if (row.fpMid) propertyPayload.fp_mid = row.fpMid
      if (row.stripeAccountEmail) propertyPayload.stripe_account_email = row.stripeAccountEmail
      
      if (!propertyPayload.expedia_status) propertyPayload.expedia_status = 'Access Required'
      if (!propertyPayload.booking_status) propertyPayload.booking_status = 'Access Required'
      if (!propertyPayload.agoda_status) propertyPayload.agoda_status = 'Access Required'

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

        // Create credentials if provided
        const credPayload: any = {}
        if (row.expediaUsername) credPayload.expediaUsername = row.expediaUsername
        if (row.agodaUsername) credPayload.agodaUsername = row.agodaUsername
        if (row.bookingUsername) credPayload.bookingUsername = row.bookingUsername
        if (row.expediaPassword) credPayload.expediaPassword = row.expediaPassword
        if (row.bookingPassword) credPayload.bookingPassword = row.bookingPassword
        if (row.agodaPassword) credPayload.agodaPassword = row.agodaPassword
        if (row.caseContactEmail) credPayload.case_contact_email = row.caseContactEmail

        if (Object.keys(credPayload).length > 0) {
          await this.prisma.propertyCredentials.create({
            data: { property_id: created.id, ...credPayload }
          })
          credentialsCreated++
        }
      } catch (err: any) {
        logger.error(`Error creating property "${propertyName}": ${err.message}`)
        skippedProperties.push({
          name: propertyName,
          reason: `Error: ${err.message}`
        })
        propertiesSkipped++
      }
    }

    return {
      propertiesCreated,
      credentialsCreated,
      propertiesSkipped,
      properties: createdProperties,
      skippedProperties
    }
  }

  async bulkDelete(ids: string[]): Promise<import('./property.interface').BulkDeleteResult> {
    const logger = new Logger('PropertyRepository')
    const success: Array<{ id: string; name: string }> = []
    const skipped: Array<{ id: string; name?: string; reason: string }> = []

    for (const id of ids) {
      try {
        const property = await this.prisma.property.findUnique({
          where: { id },
          select: { id: true, name: true }
        })

        if (!property) {
          skipped.push({
            id,
            reason: 'Property not found'
          })
          continue
        }

        await this.prisma.property.delete({ where: { id } })
        success.push({ id: property.id, name: property.name })
        logger.log(`Property "${property.name}" (${id}) deleted successfully`)
      } catch (err: any) {
        logger.error(`Error deleting property ${id}: ${err.message}`)
        skipped.push({
          id,
          reason: `Error: ${err.message}`
        })
      }
    }

    return {
      success,
      skipped,
      totalProcessed: ids.length,
      successCount: success.length,
      skippedCount: skipped.length
    }
  }
}
