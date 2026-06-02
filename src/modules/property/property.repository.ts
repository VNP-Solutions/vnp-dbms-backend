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
    if (perm.access_level === 'partial') {
      const accessRecord = await this.prisma.userAccessedProperty.findFirst({
        where: { user_id: userId },
        select: { property_id: true, portfolio_id: true }
      })

      if (!accessRecord) return []

      const propertyIds = new Set<string>(accessRecord.property_id || [])

      if (accessRecord.portfolio_id && accessRecord.portfolio_id.length > 0) {
        const portfolioProperties = await this.prisma.property.findMany({
          where: { portfolio_id: { in: accessRecord.portfolio_id } },
          select: { id: true }
        })
        portfolioProperties.forEach((p) => propertyIds.add(p.id))
      }

      return Array.from(propertyIds)
    }
    return []
  }

  async create(data: CreatePropertyDto): Promise<PropertyWithRelations> {
    const payload: any = {
      name: data.name,
      portfolio_id: data.portfolio_id,
      service_type: data.service_type,
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
      agoda_duration: data.agoda_duration,
      expedia_service_fee: data.expedia_service_fee,
      expedia_priority: data.expedia_priority,
      expedia_crs: data.expedia_crs,
      expedia_crs_db: data.expedia_crs_db,
      expedia_run_date: data.expedia_run_date,
      expedia_run_date_db: data.expedia_run_date_db,
      expedia_revised_date: data.expedia_revised_date,
      expedia_scheduler_review: data.expedia_scheduler_review,
      expedia_scheduler_db: data.expedia_scheduler_db,
      expedia_scheduler_review_db: data.expedia_scheduler_review_db,
      expedia_db_duration: data.expedia_db_duration,
      expedia_credential_verified: data.expedia_credential_verified,
      expedia_otp_number: data.expedia_otp_number,
      from_db: data.from_db,
      to_db: data.to_db,
      booking_service_fee: data.booking_service_fee,
      booking_priority: data.booking_priority,
      booking_crs: data.booking_crs,
      booking_run_date: data.booking_run_date,
      booking_revised_date: data.booking_revised_date,
      booking_credential_verified: data.booking_credential_verified,
      booking_otp_number: data.booking_otp_number,
      agoda_service_fee: data.agoda_service_fee,
      agoda_priority: data.agoda_priority,
      agoda_crs: data.agoda_crs,
      agoda_run_date: data.agoda_run_date,
      agoda_revised_date: data.agoda_revised_date,
      agoda_credential_verified: data.agoda_credential_verified,
      agoda_otp_number: data.agoda_otp_number,
      sales_rep: data.sales_rep,
      need_another_domain: data.need_another_domain,
      booking_otp_phone: data.booking_otp_phone,
      expedia_service_fee: data.expedia_service_fee,
      expedia_priority: data.expedia_priority,
      expedia_crs: data.expedia_crs,
      expedia_crs_db: data.expedia_crs_db,
      expedia_run_date: data.expedia_run_date,
      expedia_run_date_db: data.expedia_run_date_db,
      expedia_revised_date: data.expedia_revised_date,
      expedia_scheduler_review: data.expedia_scheduler_review,
      expedia_scheduler_db: data.expedia_scheduler_db,
      expedia_scheduler_review_db: data.expedia_scheduler_review_db,
      expedia_db_duration: data.expedia_db_duration,
      expedia_credential_verified: data.expedia_credential_verified,
      expedia_otp_number: data.expedia_otp_number,
      booking_service_fee: data.booking_service_fee,
      booking_priority: data.booking_priority,
      booking_crs: data.booking_crs,
      booking_run_date: data.booking_run_date,
      booking_revised_date: data.booking_revised_date,
      booking_credential_verified: data.booking_credential_verified,
      booking_otp_number: data.booking_otp_number,
      agoda_service_fee: data.agoda_service_fee,
      agoda_priority: data.agoda_priority,
      agoda_crs: data.agoda_crs,
      agoda_run_date: data.agoda_run_date,
      agoda_revised_date: data.agoda_revised_date,
      agoda_credential_verified: data.agoda_credential_verified,
      agoda_otp_number: data.agoda_otp_number,
      from_db: data.from_db,
      to_db: data.to_db,
      sales_rep: data.sales_rep,
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

    const accessRecord = await this.prisma.userAccessedProperty.findFirst({
      where: { user_id: userId },
      select: { portfolio_id: true }
    })

    const portfolioIds = accessRecord?.portfolio_id || []

    const [portfolios, subportfolios] = await Promise.all([
      portfolioIds.length
        ? this.prisma.portfolio.findMany({
            where: { id: { in: portfolioIds } },
            select: { id: true, name: true }
          })
        : [],
      portfolioIds.length
        ? this.prisma.subportfolio.findMany({
            where: { portfolio_id: { in: portfolioIds } },
            select: { id: true, name: true, portfolio_id: true }
          })
        : []
    ])

    return {
      portfolios,
      subportfolios: subportfolios.filter(
        (s: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === i
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
              service_type: defaultServiceType.type,
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
      if (row.description) propertyPayload.description = row.description
      if (row.propertyIdentifier)
        propertyPayload.property_identifier = row.propertyIdentifier
      if (row.portfolioContact)
        propertyPayload.portfolio_contact = row.portfolioContact
      if (row.expediaId) propertyPayload.expedia_id = parseInt(row.expediaId) || undefined
      if (row.agodaId) propertyPayload.agoda_id = parseInt(row.agodaId) || undefined
      if (row.bookingId) propertyPayload.booking_id = parseInt(row.bookingId) || undefined
      if (row.portfolioContactEmail) propertyPayload.portfolio_contact_email = row.portfolioContactEmail
      if (row.newDomainsEmail) propertyPayload.new_domain_email = row.newDomainsEmail
      if (row.qpUsername) propertyPayload.qp_username = row.qpUsername
      if (row.qpPassword) propertyPayload.qp_password = row.qpPassword
      if (row.qpApiKey) propertyPayload.qp_api_key = row.qpApiKey
      if (row.fpUsername) propertyPayload.fp_username = row.fpUsername
      if (row.fpPassword) propertyPayload.fp_password = row.fpPassword
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
      if (row.fpMid) propertyPayload.fp_mid = row.fpMid
      if (row.stripeAccountEmail) propertyPayload.stripe_account_email = row.stripeAccountEmail
      if (row.expediaBillingType)
        propertyPayload.expedia_billing_type = row.expediaBillingType
      if (row.expediaServiceType)
        propertyPayload.expedia_service_type = row.expediaServiceType
      if (row.expediaFrequency)
        propertyPayload.expedia_frequency = row.expediaFrequency
      if (row.expediaAccessLevel)
        propertyPayload.expedia_access_level = row.expediaAccessLevel === 'true'
      if (row.expediaFrom) propertyPayload.expedia_from = row.expediaFrom
      if (row.expediaTo) propertyPayload.expedia_to = row.expediaTo
      if (row.expediaScheduler)
        propertyPayload.expedia_scheduler = row.expediaScheduler === 'true'
      if (row.expediaDuration)
        propertyPayload.expedia_duration = parseInt(row.expediaDuration) || undefined
      if (row.bookingBillingType)
        propertyPayload.booking_billing_type = row.bookingBillingType
      if (row.bookingServiceType)
        propertyPayload.booking_service_type = row.bookingServiceType
      if (row.bookingFrequency)
        propertyPayload.booking_frequency = row.bookingFrequency
      if (row.bookingAccessLevel)
        propertyPayload.booking_access_level = row.bookingAccessLevel === 'true'
      if (row.bookingFrom) propertyPayload.booking_from = row.bookingFrom
      if (row.bookingTo) propertyPayload.booking_to = row.bookingTo
      if (row.bookingScheduler)
        propertyPayload.booking_scheduler = row.bookingScheduler === 'true'
      if (row.bookingDuration)
        propertyPayload.booking_duration = parseInt(row.bookingDuration) || undefined
      if (row.agodaBillingType)
        propertyPayload.agoda_billing_type = row.agodaBillingType
      if (row.agodaServiceType)
        propertyPayload.agoda_service_type = row.agodaServiceType
      if (row.agodaFrequency)
        propertyPayload.agoda_frequency = row.agodaFrequency
      if (row.agodaAccessLevel)
        propertyPayload.agoda_access_level = row.agodaAccessLevel === 'true'
      if (row.agodaFrom) propertyPayload.agoda_from = row.agodaFrom
      if (row.agodaTo) propertyPayload.agoda_to = row.agodaTo
      if (row.agodaScheduler)
        propertyPayload.agoda_scheduler = row.agodaScheduler === 'true'
      if (row.agodaDuration)
        propertyPayload.agoda_duration = parseInt(row.agodaDuration) || undefined
      
      if (row.needAnotherDomain)
        propertyPayload.need_another_domain = row.needAnotherDomain === 'true'
      if (row.bookingOtpPhone)
        propertyPayload.booking_otp_phone = row.bookingOtpPhone
      if (row.expediaServiceFee) 
        propertyPayload.expedia_service_fee = row.expediaServiceFee
      if (row.expediaPriority) 
        propertyPayload.expedia_priority = row.expediaPriority
      if (row.expediaCrs) 
        propertyPayload.expedia_crs = row.expediaCrs
      if (row.expediaCrsDb) 
        propertyPayload.expedia_crs_db = row.expediaCrsDb
      if (row.expediaRunDate) 
        propertyPayload.expedia_run_date = row.expediaRunDate
      if (row.expediaRunDateDb) 
        propertyPayload.expedia_run_date_db = row.expediaRunDateDb
      if (row.expediaRevisedDate) 
        propertyPayload.expedia_revised_date = row.expediaRevisedDate
      if (row.expediaSchedulerReview) 
        propertyPayload.expedia_scheduler_review = row.expediaSchedulerReview
      if (row.expediaSchedulerDb) 
        propertyPayload.expedia_scheduler_db = row.expediaSchedulerDb
      if (row.expediaSchedulerReviewDb) 
        propertyPayload.expedia_scheduler_review_db = row.expediaSchedulerReviewDb
      if (row.expediaDbDuration) 
        propertyPayload.expedia_db_duration = parseInt(row.expediaDbDuration) || undefined
      if (row.expediaCredentialVerified) 
        propertyPayload.expedia_credential_verified = row.expediaCredentialVerified
      if (row.expediaOtpNumber) 
        propertyPayload.expedia_otp_number = row.expediaOtpNumber
      if (row.bookingServiceFee) 
        propertyPayload.booking_service_fee = row.bookingServiceFee
      if (row.bookingPriority) 
        propertyPayload.booking_priority = row.bookingPriority
      if (row.bookingCrs) 
        propertyPayload.booking_crs = row.bookingCrs
      if (row.bookingRunDate) 
        propertyPayload.booking_run_date = row.bookingRunDate
      if (row.bookingRevisedDate) 
        propertyPayload.booking_revised_date = row.bookingRevisedDate
      if (row.bookingCredentialVerified) 
        propertyPayload.booking_credential_verified = row.bookingCredentialVerified
      if (row.bookingOtpNumber) 
        propertyPayload.booking_otp_number = row.bookingOtpNumber
      if (row.agodaServiceFee) 
        propertyPayload.agoda_service_fee = row.agodaServiceFee
      if (row.agodaPriority) 
        propertyPayload.agoda_priority = row.agodaPriority
      if (row.agodaCrs) 
        propertyPayload.agoda_crs = row.agodaCrs
      if (row.agodaRunDate) 
        propertyPayload.agoda_run_date = row.agodaRunDate
      if (row.agodaRevisedDate) 
        propertyPayload.agoda_revised_date = row.agodaRevisedDate
      if (row.agodaCredentialVerified) 
        propertyPayload.agoda_credential_verified = row.agodaCredentialVerified
      if (row.agodaOtpNumber) 
        propertyPayload.agoda_otp_number = row.agodaOtpNumber
      if (row.fromDb) 
        propertyPayload.from_db = row.fromDb
      if (row.toDb) 
        propertyPayload.to_db = row.toDb
      if (row.salesRep) 
        propertyPayload.sales_rep = row.salesRep
      if (row.caseContactEmail)
        propertyPayload.primary_case_email = row.caseContactEmail
      if (row.serviceTypeName) {
        propertyPayload.service_type = row.serviceTypeName.trim()
      }
      if (!propertyPayload.expedia_status) 
        propertyPayload.expedia_status = 'Access Required'
      if (!propertyPayload.booking_status) 
        propertyPayload.booking_status = 'Access Required'
      if (!propertyPayload.agoda_status) 
        propertyPayload.agoda_status = 'Access Required'

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
        if (row.expediaSecondaryUsername)
          credPayload.expediaSecondaryUsername = row.expediaSecondaryUsername
        if (row.expediaSecondaryPassword)
          credPayload.expediaSecondaryPassword = row.expediaSecondaryPassword
        if (row.bookingSecondaryUsername)
          credPayload.bookingSecondaryUsername = row.bookingSecondaryUsername
        if (row.bookingSecondaryPassword)
          credPayload.bookingSecondaryPassword = row.bookingSecondaryPassword
        if (row.agodaSecondaryUsername)
          credPayload.agodaSecondaryUsername = row.agodaSecondaryUsername
        if (row.agodaSecondaryPassword)
          credPayload.agodaSecondaryPassword = row.agodaSecondaryPassword

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
