import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto'
import {
  collectPropertyUniqueConflicts,
  normalizePropertyIdentifier,
  propertyIdentifierKey
} from './property-uniqueness.util'
import type {
  ImportPropertiesResult,
  ImportPropertyRow,
  IPropertyRepository,
  PropertyWithRelations
} from './property.interface'

const propertyInclude = {
  portfolio: { select: { id: true, name: true } },
  subportfolio: { select: { id: true, name: true, portfolio_id: true } },
  credentials: true,
  currency: true,
  service_type: true,
  expedia_service_type: true,
  booking_service_type: true,
  agoda_service_type: true,
  expedia_billing_type: true,
  booking_billing_type: true,
  agoda_billing_type: true,
  expedia_frequency: true,
  booking_frequency: true,
  agoda_frequency: true,
  expedia_processor: true,
  booking_processor: true,
  agoda_processor: true,
  priority: true,
  notes: {
    select: {
      id: true,
      text: true,
      is_done: true,
      user_id: true,
      created_at: true,
      updated_at: true
    },
    orderBy: { created_at: 'desc' as const }
  },
  _count: { select: { notes: true } }
}

function withTotalNotes<T extends { _count: { notes: number } }>(
  raw: T
): Omit<T, '_count'> & { total_notes: number } {
  const { _count, ...rest } = raw
  return { ...rest, total_notes: _count.notes }
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
        portfolioProperties.forEach(p => propertyIds.add(p.id))
      }

      return Array.from(propertyIds)
    }
    return []
  }

  async create(data: CreatePropertyDto): Promise<PropertyWithRelations> {
    const payload: any = {
      name: data.name,
      portfolio_id: data.portfolio_id,
      service_type_id: data.service_type_id,
      currency_id: data.currency_id,
      card_descriptor: data.card_descriptor,
      is_active: data.is_active ?? true,
      next_due_date: data.next_due_date
        ? new Date(data.next_due_date)
        : undefined,
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
      expedia_processor_id: data.expedia_processor_id,
      booking_processor_id: data.booking_processor_id,
      agoda_processor_id: data.agoda_processor_id,
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
      expedia_billing_type_id: data.expedia_billing_type_id,
      expedia_service_type_id: data.expedia_service_type_id,
      expedia_frequency_id: data.expedia_frequency_id,
      expedia_access_level: data.expedia_access_level,
      expedia_from: data.expedia_from,
      expedia_to: data.expedia_to,
      expedia_priority: data.expedia_priority,
      expedia_scheduler: data.expedia_scheduler,
      expedia_duration: data.expedia_duration,
      booking_billing_type_id: data.booking_billing_type_id,
      booking_service_type_id: data.booking_service_type_id,
      booking_frequency_id: data.booking_frequency_id,
      booking_access_level: data.booking_access_level,
      booking_from: data.booking_from,
      booking_to: data.booking_to,
      booking_priority: data.booking_priority,
      booking_scheduler: data.booking_scheduler,
      booking_duration: data.booking_duration,
      agoda_billing_type_id: data.agoda_billing_type_id,
      agoda_service_type_id: data.agoda_service_type_id,
      agoda_frequency_id: data.agoda_frequency_id,
      agoda_access_level: data.agoda_access_level,
      agoda_from: data.agoda_from,
      agoda_to: data.agoda_to,
      agoda_priority: data.agoda_priority,
      agoda_scheduler: data.agoda_scheduler,
      agoda_duration: data.agoda_duration,
      expedia_service_fee: data.expedia_service_fee,
      priority_id: data.priority_id,
      expedia_crs: data.expedia_crs,
      expedia_crs_db: data.expedia_crs_db,
      expedia_run_date: data.expedia_run_date,
      expedia_run_date_db: data.expedia_run_date_db,
      expedia_revised_date: data.expedia_revised_date,
      expedia_scheduler_review_from: data.expedia_scheduler_review_from,
      expedia_scheduler_review_to: data.expedia_scheduler_review_to,
      expedia_scheduler_db: data.expedia_scheduler_db,
      expedia_scheduler_review_db_from: data.expedia_scheduler_review_db_from,
      expedia_scheduler_review_db_to: data.expedia_scheduler_review_db_to,
      expedia_db_duration: data.expedia_db_duration,
      expedia_credential_verified: data.expedia_credential_verified,
      expedia_otp_number: data.expedia_otp_number,
      from_db: data.from_db,
      to_db: data.to_db,
      booking_service_fee: data.booking_service_fee,
      booking_crs: data.booking_crs,
      booking_run_date: data.booking_run_date,
      booking_revised_date: data.booking_revised_date,
      booking_credential_verified: data.booking_credential_verified,
      booking_otp_number: data.booking_otp_number,
      agoda_service_fee: data.agoda_service_fee,
      agoda_crs: data.agoda_crs,
      agoda_run_date: data.agoda_run_date,
      agoda_revised_date: data.agoda_revised_date,
      agoda_credential_verified: data.agoda_credential_verified,
      agoda_otp_number: data.agoda_otp_number,
      sales_rep: data.sales_rep,
      discontinued_email_ids: data.discontinued_email_ids ?? [],
      cybersource_mid: data.cybersource_mid,
      adyen_location: data.adyen_location,
      stripe_connected_email: data.stripe_connected_email,
      need_another_domain: data.need_another_domain,
      booking_otp_phone: data.booking_otp_phone
    }
    if (data.subportfolio_id) payload.subportfolio_id = data.subportfolio_id

    const raw = await this.prisma.property.create({
      data: payload,
      include: propertyInclude
    })
    return withTotalNotes(raw) as PropertyWithRelations
  }

  async findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PropertyWithRelations[]> {
    const { where, skip, take, orderBy } = queryOptions
    const safeWhere = await this.withValidPortfolioFilter(where)
    const rows = await this.prisma.property.findMany({
      where: safeWhere,
      skip,
      take,
      orderBy,
      include: propertyInclude
    })
    return rows.map(withTotalNotes) as PropertyWithRelations[]
  }

  async count(where: any): Promise<number> {
    const safeWhere = await this.withValidPortfolioFilter(where)
    return this.prisma.property.count({ where: safeWhere })
  }

  /**
   * MongoDB does not enforce referential integrity. Properties whose portfolio_id
   * references a deleted portfolio cause Prisma to throw
   * "required relation returned null" when the portfolio is included.
   * This helper restricts the where clause to only existing portfolio IDs.
   */
  private async withValidPortfolioFilter(where: any): Promise<any> {
    const validIds = await this.prisma.portfolio
      .findMany({ select: { id: true } })
      .then(rows => rows.map(r => r.id))
    return { ...where, portfolio_id: { in: validIds } }
  }

  async findById(id: string): Promise<PropertyWithRelations | null> {
    const raw = await this.prisma.property.findUnique({
      where: { id },
      include: propertyInclude
    })
    return raw ? (withTotalNotes(raw) as PropertyWithRelations) : null
  }

  async findByIds(ids: string[]): Promise<PropertyWithRelations[]> {
    if (!ids.length) return []
    const rows = await this.prisma.property.findMany({
      where: { id: { in: ids } },
      include: propertyInclude
    })
    return rows.map(withTotalNotes) as PropertyWithRelations[]
  }

  async findIdsByOtaIds(ota: {
    expedia_id?: number | null
    booking_id?: number | null
    agoda_id?: number | null
  }): Promise<string[]> {
    const or: any[] = []
    if (ota.expedia_id != null) or.push({ expedia_id: Number(ota.expedia_id) })
    if (ota.booking_id != null) or.push({ booking_id: Number(ota.booking_id) })
    if (ota.agoda_id != null) or.push({ agoda_id: Number(ota.agoda_id) })
    if (!or.length) return []
    const rows = await this.prisma.property.findMany({
      where: { OR: or },
      select: { id: true }
    })
    return rows.map(r => r.id)
  }

  async findByName(name: string) {
    return this.prisma.property.findUnique({ where: { name } })
  }

  async update(
    id: string,
    data: UpdatePropertyDto
  ): Promise<PropertyWithRelations> {
    // Helper: convert a nullable FK id to Prisma connect/disconnect syntax
    const rel = (fkId: string | null | undefined) => {
      if (fkId === undefined) return undefined
      return fkId ? { connect: { id: fkId } } : { disconnect: true }
    }

    const d = data as any

    // Scalar (non-relation) fields — spread directly
    const payload: any = {
      name: d.name,
      property_identifier: d.property_identifier,
      card_descriptor: d.card_descriptor,
      description: d.description,
      hotel_address: d.hotel_address,
      previous_portfolio_id: d.previous_portfolio_id,
      show_in_portfolio: d.show_in_portfolio,
      new_domain_email: d.new_domain_email,
      others_case_emails: d.others_case_emails,
      primary_case_email: d.primary_case_email,
      portfolio_contact_email: d.portfolio_contact_email,
      portfolio_contact: d.portfolio_contact,
      webmail_password: d.webmail_password,
      case_management_contact: d.case_management_contact,
      access_contact: d.access_contact,
      reporting_contact: d.reporting_contact,
      from: d.from,
      to: d.to,
      qp_username: d.qp_username,
      qp_password: d.qp_password,
      qp_api_key: d.qp_api_key,
      fp_mid: d.fp_mid,
      fp_username: d.fp_username,
      fp_password: d.fp_password,
      stripe_account_email: d.stripe_account_email,
      expedia_id: d.expedia_id,
      expedia_status: d.expedia_status,
      expedia_access_level: d.expedia_access_level,
      expedia_from: d.expedia_from,
      expedia_to: d.expedia_to,
      expedia_priority: d.expedia_priority,
      from_db: d.from_db,
      to_db: d.to_db,
      expedia_scheduler: d.expedia_scheduler,
      expedia_duration: d.expedia_duration,
      expedia_db_duration: d.expedia_db_duration,
      expedia_service_fee: d.expedia_service_fee,
      expedia_crs: d.expedia_crs,
      expedia_crs_db: d.expedia_crs_db,
      expedia_run_date: d.expedia_run_date,
      expedia_run_date_db: d.expedia_run_date_db,
      expedia_revised_date: d.expedia_revised_date,
      expedia_scheduler_review_from: d.expedia_scheduler_review_from,
      expedia_scheduler_review_to: d.expedia_scheduler_review_to,
      expedia_scheduler_db: d.expedia_scheduler_db,
      expedia_scheduler_review_db_from: d.expedia_scheduler_review_db_from,
      expedia_scheduler_review_db_to: d.expedia_scheduler_review_db_to,
      expedia_credential_verified: d.expedia_credential_verified,
      expedia_otp_number: d.expedia_otp_number,
      booking_id: d.booking_id,
      booking_status: d.booking_status,
      booking_access_level: d.booking_access_level,
      booking_from: d.booking_from,
      booking_to: d.booking_to,
      booking_priority: d.booking_priority,
      booking_scheduler: d.booking_scheduler,
      booking_duration: d.booking_duration,
      booking_service_fee: d.booking_service_fee,
      booking_crs: d.booking_crs,
      booking_run_date: d.booking_run_date,
      booking_revised_date: d.booking_revised_date,
      booking_credential_verified: d.booking_credential_verified,
      booking_otp_number: d.booking_otp_number,
      agoda_id: d.agoda_id,
      agoda_status: d.agoda_status,
      agoda_access_level: d.agoda_access_level,
      agoda_from: d.agoda_from,
      agoda_to: d.agoda_to,
      agoda_priority: d.agoda_priority,
      agoda_scheduler: d.agoda_scheduler,
      agoda_duration: d.agoda_duration,
      agoda_service_fee: d.agoda_service_fee,
      agoda_crs: d.agoda_crs,
      agoda_run_date: d.agoda_run_date,
      agoda_revised_date: d.agoda_revised_date,
      agoda_credential_verified: d.agoda_credential_verified,
      agoda_otp_number: d.agoda_otp_number,
      need_another_domain: d.need_another_domain,
      booking_otp_phone: d.booking_otp_phone,
      sales_rep: d.sales_rep,
      cybersource_mid: d.cybersource_mid,
      adyen_location: d.adyen_location,
      stripe_connected_email: d.stripe_connected_email,
      // Non-nullable String[] — null → empty array
      discontinued_email_ids:
        d.discontinued_email_ids !== undefined
          ? (d.discontinued_email_ids ?? [])
          : undefined
    }

    // Remove undefined keys so Prisma ignores unset fields
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key]
    }

    // Special scalar conversions
    if (d.next_due_date !== undefined) {
      payload.next_due_date = d.next_due_date ? new Date(d.next_due_date) : null
    }
    if (d.is_active !== undefined) payload.is_active = d.is_active

    // All FK relations — must use nested connect/disconnect in update()
    const portfolioRel = rel(d.portfolio_id)
    if (portfolioRel) payload.portfolio = portfolioRel
    if (d.subportfolio_id !== undefined)
      payload.subportfolio = rel(d.subportfolio_id)
    if (d.service_type_id !== undefined)
      payload.service_type = rel(d.service_type_id)
    if (d.currency_id !== undefined) payload.currency = rel(d.currency_id)
    if (d.expedia_billing_type_id !== undefined)
      payload.expedia_billing_type = rel(d.expedia_billing_type_id)
    if (d.expedia_service_type_id !== undefined)
      payload.expedia_service_type = rel(d.expedia_service_type_id)
    if (d.expedia_frequency_id !== undefined)
      payload.expedia_frequency = rel(d.expedia_frequency_id)
    if (d.priority_id !== undefined) payload.priority = rel(d.priority_id)
    if (d.expedia_processor_id !== undefined)
      payload.expedia_processor = rel(d.expedia_processor_id)
    if (d.booking_billing_type_id !== undefined)
      payload.booking_billing_type = rel(d.booking_billing_type_id)
    if (d.booking_service_type_id !== undefined)
      payload.booking_service_type = rel(d.booking_service_type_id)
    if (d.booking_frequency_id !== undefined)
      payload.booking_frequency = rel(d.booking_frequency_id)
    if (d.booking_processor_id !== undefined)
      payload.booking_processor = rel(d.booking_processor_id)
    if (d.agoda_billing_type_id !== undefined)
      payload.agoda_billing_type = rel(d.agoda_billing_type_id)
    if (d.agoda_service_type_id !== undefined)
      payload.agoda_service_type = rel(d.agoda_service_type_id)
    if (d.agoda_frequency_id !== undefined)
      payload.agoda_frequency = rel(d.agoda_frequency_id)
    if (d.agoda_processor_id !== undefined)
      payload.agoda_processor = rel(d.agoda_processor_id)

    const raw = await this.prisma.property.update({
      where: { id },
      data: payload,
      include: propertyInclude
    })
    return withTotalNotes(raw) as PropertyWithRelations
  }

  async delete(id: string) {
    return this.prisma.property.delete({ where: { id } })
  }

  async findByPortfolioId(
    portfolioId: string
  ): Promise<PropertyWithRelations[]> {
    // The property's own portfolio only — no fallback to the subportfolio's
    // parent portfolio, which would return properties belonging elsewhere.
    const rows = await this.prisma.property.findMany({
      where: { portfolio_id: portfolioId },
      include: propertyInclude
    })
    return rows.map(withTotalNotes) as PropertyWithRelations[]
  }

  async findBySubportfolioId(
    subportfolioId: string
  ): Promise<PropertyWithRelations[]> {
    const rows = await this.prisma.property.findMany({
      where: { subportfolio_id: subportfolioId },
      include: propertyInclude
    })
    return rows.map(withTotalNotes) as PropertyWithRelations[]
  }

  async getDropdownPortfoliosAndSubportfolios(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: { portfolio_permission: true, property_permission: true }
        }
      }
    })
    const portfolioPerm = user?.role?.portfolio_permission
    const propertyPerm = user?.role?.property_permission
    const hasAllPortfolios = portfolioPerm?.access_level === 'all'
    const hasAllProperties = propertyPerm?.access_level === 'all'

    if (hasAllPortfolios && hasAllProperties) {
      const [portfolios, subportfolios] = await Promise.all([
        this.prisma.portfolio.findMany({ select: { id: true, name: true } }),
        this.prisma.subportfolio.findMany({
          select: { id: true, name: true, portfolio_id: true }
        })
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
        (s: any, i: number, arr: any[]) =>
          arr.findIndex((x: any) => x.id === s.id) === i
      )
    }
  }

  /**
   * Bulk-imports properties from pre-parsed, typed rows.
   * Auto-creates portfolios if they don't exist.
   */
  async importProperties(
    rows: ImportPropertyRow[],
    userId?: string
  ): Promise<ImportPropertiesResult> {
    const logger = new Logger(PropertyRepository.name)

    let propertiesCreated = 0
    let credentialsCreated = 0
    let propertiesSkipped = 0
    const createdProperties: any[] = []
    const skippedProperties: Array<{ name: string; reason: string }> = []
    const existingProperties: any[] = []
    const createdPortfolios: Array<{ id: string; name: string }> = []
    const createdSubportfolios: Array<{
      id: string
      name: string
      portfolio_id: string
    }> = []
    const seenIdentifiersInBatch = new Set<string>()

    for (const row of rows) {
      const { propertyName, portfolioName } = row

      const normalizedIdentifier = normalizePropertyIdentifier(
        row.propertyIdentifier
      )
      if (!normalizedIdentifier) {
        skippedProperties.push({
          name: propertyName,
          reason: 'Property Identifier is required'
        })
        propertiesSkipped++
        continue
      }

      // Find or create portfolio by name
      const portfolioResult = await this.resolveOrCreatePortfolio(
        portfolioName,
        logger
      )
      if ('error' in portfolioResult) {
        skippedProperties.push({
          name: propertyName,
          reason: portfolioResult.error
        })
        propertiesSkipped++
        continue
      }
      const portfolio = { id: portfolioResult.id, name: portfolioResult.name }
      if (portfolioResult.created) {
        createdPortfolios.push({ id: portfolio.id, name: portfolio.name })
      }

      let subportfolioId: string | undefined
      if (row.subportfolioName) {
        const subResult = await this.resolveOrCreateSubportfolio(
          row.subportfolioName,
          portfolio.id
        )
        if ('error' in subResult) {
          skippedProperties.push({
            name: propertyName,
            reason: subResult.error
          })
          propertiesSkipped++
          continue
        }
        subportfolioId = subResult.id
        if (subResult.created) {
          createdSubportfolios.push({
            id: subResult.id,
            name: row.subportfolioName.trim(),
            portfolio_id: portfolio.id
          })
        }
      }

      // Check if property already exists
      const existingProp = await this.findByName(propertyName)
      if (existingProp) {
        // Property already exists — only create/update credentials if provided
        const credPayloadExisting: any = {}
        if (row.expediaUsername)
          credPayloadExisting.expediaUsername = row.expediaUsername
        if (row.agodaUsername)
          credPayloadExisting.agodaUsername = row.agodaUsername
        if (row.bookingUsername)
          credPayloadExisting.bookingUsername = row.bookingUsername
        if (row.expediaPassword)
          credPayloadExisting.expediaPassword = row.expediaPassword
        if (row.bookingPassword)
          credPayloadExisting.bookingPassword = row.bookingPassword
        if (row.agodaPassword)
          credPayloadExisting.agodaPassword = row.agodaPassword
        if (row.expediaSecondaryUsername)
          credPayloadExisting.expediaSecondaryUsername =
            row.expediaSecondaryUsername
        if (row.expediaSecondaryPassword)
          credPayloadExisting.expediaSecondaryPassword =
            row.expediaSecondaryPassword
        if (row.bookingSecondaryUsername)
          credPayloadExisting.bookingSecondaryUsername =
            row.bookingSecondaryUsername
        if (row.bookingSecondaryPassword)
          credPayloadExisting.bookingSecondaryPassword =
            row.bookingSecondaryPassword
        if (row.agodaSecondaryUsername)
          credPayloadExisting.agodaSecondaryUsername =
            row.agodaSecondaryUsername
        if (row.agodaSecondaryPassword)
          credPayloadExisting.agodaSecondaryPassword =
            row.agodaSecondaryPassword

        if (Object.keys(credPayloadExisting).length > 0) {
          const existingCred = await this.prisma.propertyCredentials.findFirst({
            where: { property_id: existingProp.id }
          })
          if (existingCred) {
            await this.prisma.propertyCredentials.update({
              where: { id: existingCred.id },
              data: credPayloadExisting
            })
            logger.log(
              `Credentials updated for existing property "${propertyName}"`
            )
          } else {
            await this.prisma.propertyCredentials.create({
              data: { property_id: existingProp.id, ...credPayloadExisting }
            })
            credentialsCreated++
            logger.log(
              `Credentials created for existing property "${propertyName}"`
            )
          }
        } else {
          logger.debug(
            `Property "${propertyName}" already exists and no credentials provided — skipping`
          )
        }

        const existingUpdates: { subportfolio_id?: string; portfolio_id?: string } =
          {}
        if (subportfolioId) {
          existingUpdates.subportfolio_id = subportfolioId
        }
        if (portfolio.id !== existingProp.portfolio_id) {
          existingUpdates.portfolio_id = portfolio.id
        }
        if (Object.keys(existingUpdates).length) {
          await this.prisma.property.update({
            where: { id: existingProp.id },
            data: existingUpdates
          })
          if (existingUpdates.subportfolio_id) {
            logger.log(
              `Subportfolio assigned to existing property "${propertyName}"`
            )
          }
          if (existingUpdates.portfolio_id) {
            logger.log(
              `Portfolio reassigned on existing property "${propertyName}"`
            )
          }
        }

        const linkedSubportfolio = subportfolioId
          ? await this.prisma.subportfolio.findUnique({
              where: { id: subportfolioId },
              select: { id: true, name: true, portfolio_id: true }
            })
          : null

        existingProperties.push({
          ...existingProp,
          portfolio: { id: portfolio.id, name: portfolio.name },
          subportfolio: linkedSubportfolio
        })

        skippedProperties.push({
          name: propertyName,
          reason: 'Property already exists (credentials updated if provided)'
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

      if (subportfolioId) propertyPayload.subportfolio_id = subportfolioId

      if (row.propertyAddress)
        propertyPayload.hotel_address = row.propertyAddress
      if (row.cardDescriptor)
        propertyPayload.card_descriptor = row.cardDescriptor
      if (row.description) propertyPayload.description = row.description
      propertyPayload.property_identifier = normalizedIdentifier
      if (row.portfolioContact)
        propertyPayload.portfolio_contact = row.portfolioContact
      if (row.expediaId)
        propertyPayload.expedia_id = parseInt(row.expediaId) || undefined
      if (row.agodaId)
        propertyPayload.agoda_id = parseInt(row.agodaId) || undefined
      if (row.bookingId)
        propertyPayload.booking_id = parseInt(row.bookingId) || undefined
      if (row.portfolioContactEmail)
        propertyPayload.portfolio_contact_email = row.portfolioContactEmail
      if (row.newDomainsEmail)
        propertyPayload.new_domain_email = row.newDomainsEmail
      if (row.qpUsername) propertyPayload.qp_username = row.qpUsername
      if (row.qpPassword) propertyPayload.qp_password = row.qpPassword
      if (row.qpApiKey) propertyPayload.qp_api_key = row.qpApiKey
      if (row.fpUsername) propertyPayload.fp_username = row.fpUsername
      if (row.fpPassword) propertyPayload.fp_password = row.fpPassword
      if (row.webmailPassword)
        propertyPayload.webmail_password = row.webmailPassword
      if (row.expediaStatus) propertyPayload.expedia_status = row.expediaStatus
      if (row.bookingStatus) propertyPayload.booking_status = row.bookingStatus
      if (row.agodaStatus) propertyPayload.agoda_status = row.agodaStatus
      if (row.caseManagementContact)
        propertyPayload.case_management_contact = row.caseManagementContact
      if (row.accessContact) propertyPayload.access_contact = row.accessContact
      if (row.reportingContact)
        propertyPayload.reporting_contact = row.reportingContact
      // Normalize a string to UPPER_SNAKE_CASE (for ServiceType and Frequency)
      const toUpperSnakeCase = (val: string): string =>
        val
          .trim()
          .toUpperCase()
          .replace(/[\s\-.]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/, '')

      // Helper: resolve processor name → ID (find or create)
      const resolveProcessor = async (
        name?: string
      ): Promise<string | undefined> => {
        if (!name) return undefined
        const normalized = name.trim()
        let rec = await this.prisma.processor.findFirst({
          where: { name: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const last = await this.prisma.processor.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.processor.create({
            data: {
              name: normalized,
              is_active: true,
              order: (last?.order ?? 0) + 1
            }
          })
          logger.log(`Processor "${normalized}" created during import`)
        }
        return rec.id
      }

      // Helper: resolve service type name → ID (normalize to UPPER_SNAKE_CASE, find or create)
      const resolveServiceType = async (
        name?: string
      ): Promise<string | undefined> => {
        if (!name) return undefined
        const normalized = toUpperSnakeCase(name)
        let rec = await this.prisma.serviceType.findFirst({
          where: { type: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const maxOrder = await this.prisma.serviceType.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.serviceType.create({
            data: {
              type: normalized,
              is_active: true,
              order: (maxOrder?.order ?? 0) + 1
            }
          })
          logger.log(`ServiceType "${normalized}" created during import`)
        }
        return rec.id
      }

      // Helper: resolve billing type name → ID (find or create)
      const resolveBillingType = async (
        name?: string
      ): Promise<string | undefined> => {
        if (!name) return undefined
        const normalized = name.trim()
        let rec = await this.prisma.billingType.findFirst({
          where: { name: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const last = await this.prisma.billingType.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.billingType.create({
            data: {
              name: normalized,
              is_active: true,
              order: (last?.order ?? 0) + 1
            }
          })
          logger.log(`BillingType "${normalized}" created during import`)
        }
        return rec.id
      }

      // Helper: resolve frequency name → ID (normalize to UPPER_SNAKE_CASE, find or create)
      const resolveFrequency = async (
        name?: string
      ): Promise<string | undefined> => {
        if (!name) return undefined
        const normalized = toUpperSnakeCase(name)
        let rec = await this.prisma.frequency.findFirst({
          where: { name: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const last = await this.prisma.frequency.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.frequency.create({
            data: {
              name: normalized,
              is_active: true,
              order: (last?.order ?? 0) + 1
            }
          })
          logger.log(`Frequency "${normalized}" created during import`)
        }
        return rec.id
      }

      // Helper: resolve priority name → priority_id (find or create Priority record, return id)
      const resolvePriority = async (
        name?: string
      ): Promise<string | undefined> => {
        if (!name) return undefined
        const normalized = name.trim()
        let rec = await this.prisma.priority.findFirst({
          where: { name: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const last = await this.prisma.priority.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.priority.create({
            data: {
              name: normalized,
              is_active: true,
              order: (last?.order ?? 0) + 1
            }
          })
          logger.log(`Priority "${normalized}" created during import`)
        }
        return rec.id
      }

      // Helper: resolve currency code → currency_id (find or create Currency, return id)
      const resolveCurrency = async (
        code?: string
      ): Promise<string | undefined> => {
        if (!code) return undefined
        const normalized = code.trim().toUpperCase()
        let rec = await this.prisma.currency.findFirst({
          where: { code: { equals: normalized, mode: 'insensitive' } }
        })
        if (!rec) {
          const last = await this.prisma.currency.findFirst({
            orderBy: { order: 'desc' },
            select: { order: true }
          })
          rec = await this.prisma.currency.create({
            data: {
              code: normalized,
              name: normalized,
              is_active: true,
              order: (last?.order ?? 0) + 1
            }
          })
          logger.log(`Currency "${normalized}" created during import`)
        }
        return rec.id
      }

      if (row.expediaProcessor)
        propertyPayload.expedia_processor_id = await resolveProcessor(
          row.expediaProcessor
        )
      if (row.bookingProcessor)
        propertyPayload.booking_processor_id = await resolveProcessor(
          row.bookingProcessor
        )
      if (row.agodaProcessor)
        propertyPayload.agoda_processor_id = await resolveProcessor(
          row.agodaProcessor
        )
      if (row.priority)
        propertyPayload.priority_id = await resolvePriority(row.priority)
      if (row.fpMid) propertyPayload.fp_mid = row.fpMid
      if (row.stripeAccountEmail)
        propertyPayload.stripe_account_email = row.stripeAccountEmail
      if (row.expediaBillingType)
        propertyPayload.expedia_billing_type_id = await resolveBillingType(
          row.expediaBillingType
        )
      if (row.expediaServiceType)
        propertyPayload.expedia_service_type_id = await resolveServiceType(
          row.expediaServiceType
        )
      if (row.expediaFrequency)
        propertyPayload.expedia_frequency_id = await resolveFrequency(
          row.expediaFrequency
        )
      if (row.expediaPriority)
        propertyPayload.expedia_priority = row.expediaPriority
      if (row.bookingPriority)
        propertyPayload.booking_priority = row.bookingPriority
      if (row.agodaPriority) propertyPayload.agoda_priority = row.agodaPriority
      if (row.expediaAccessLevel)
        propertyPayload.expedia_access_level = row.expediaAccessLevel === 'true'
      if (row.expediaFrom) propertyPayload.expedia_from = row.expediaFrom
      if (row.expediaTo) propertyPayload.expedia_to = row.expediaTo
      if (row.expediaScheduler)
        propertyPayload.expedia_scheduler = row.expediaScheduler === 'true'
      if (row.expediaDuration)
        propertyPayload.expedia_duration =
          parseInt(row.expediaDuration) || undefined
      if (row.bookingBillingType)
        propertyPayload.booking_billing_type_id = await resolveBillingType(
          row.bookingBillingType
        )
      if (row.bookingServiceType)
        propertyPayload.booking_service_type_id = await resolveServiceType(
          row.bookingServiceType
        )
      if (row.bookingFrequency)
        propertyPayload.booking_frequency_id = await resolveFrequency(
          row.bookingFrequency
        )
      if (row.bookingAccessLevel)
        propertyPayload.booking_access_level = row.bookingAccessLevel === 'true'
      if (row.bookingFrom) propertyPayload.booking_from = row.bookingFrom
      if (row.bookingTo) propertyPayload.booking_to = row.bookingTo
      if (row.bookingScheduler)
        propertyPayload.booking_scheduler = row.bookingScheduler === 'true'
      if (row.bookingDuration)
        propertyPayload.booking_duration =
          parseInt(row.bookingDuration) || undefined
      if (row.agodaBillingType)
        propertyPayload.agoda_billing_type_id = await resolveBillingType(
          row.agodaBillingType
        )
      if (row.agodaServiceType)
        propertyPayload.agoda_service_type_id = await resolveServiceType(
          row.agodaServiceType
        )
      if (row.agodaFrequency)
        propertyPayload.agoda_frequency_id = await resolveFrequency(
          row.agodaFrequency
        )
      if (row.agodaAccessLevel)
        propertyPayload.agoda_access_level = row.agodaAccessLevel === 'true'
      if (row.agodaFrom) propertyPayload.agoda_from = row.agodaFrom
      if (row.agodaTo) propertyPayload.agoda_to = row.agodaTo
      if (row.agodaScheduler)
        propertyPayload.agoda_scheduler = row.agodaScheduler === 'true'
      if (row.agodaDuration)
        propertyPayload.agoda_duration =
          parseInt(row.agodaDuration) || undefined

      if (row.needAnotherDomain)
        propertyPayload.need_another_domain = row.needAnotherDomain === 'true'
      if (row.bookingOtpPhone)
        propertyPayload.booking_otp_phone = row.bookingOtpPhone
      if (row.caseContactEmail)
        propertyPayload.primary_case_email = row.caseContactEmail
      // New Expedia fields
      if (row.expediaServiceFee)
        propertyPayload.expedia_service_fee =
          parseInt(row.expediaServiceFee) || undefined
      if (row.expediaCrs) propertyPayload.expedia_crs = row.expediaCrs
      if (row.expediaCrsDb) propertyPayload.expedia_crs_db = row.expediaCrsDb
      if (row.expediaRunDateFrom)
        propertyPayload.expedia_run_date = row.expediaRunDateFrom
      if (row.expediaRunDateDbFrom)
        propertyPayload.expedia_run_date_db = row.expediaRunDateDbFrom
      if (row.expediaRevisedDate)
        propertyPayload.expedia_revised_date = row.expediaRevisedDate
      if (row.expediaSchedulerReviewFrom)
        propertyPayload.expedia_scheduler_review_from =
          row.expediaSchedulerReviewFrom
      if (row.expediaSchedulerReviewTo)
        propertyPayload.expedia_scheduler_review_to =
          row.expediaSchedulerReviewTo
      if (row.expediaSchedulerDb)
        propertyPayload.expedia_scheduler_db = row.expediaSchedulerDb
      if (row.expediaSchedulerReviewDbFrom)
        propertyPayload.expedia_scheduler_review_db_from =
          row.expediaSchedulerReviewDbFrom
      if (row.expediaSchedulerReviewDbTo)
        propertyPayload.expedia_scheduler_review_db_to =
          row.expediaSchedulerReviewDbTo
      if (row.expediaDbDuration)
        propertyPayload.expedia_db_duration =
          parseInt(row.expediaDbDuration) || undefined
      if (row.expediaCredentialVerified !== undefined)
        propertyPayload.expedia_credential_verified =
          row.expediaCredentialVerified === 'true'
      if (row.expediaOtpNumber)
        propertyPayload.expedia_otp_number = row.expediaOtpNumber
      if (row.fromDb) propertyPayload.from_db = row.fromDb
      if (row.toDb) propertyPayload.to_db = row.toDb
      // New Booking fields
      if (row.bookingServiceFee)
        propertyPayload.booking_service_fee =
          parseInt(row.bookingServiceFee) || undefined
      if (row.bookingCrs) propertyPayload.booking_crs = row.bookingCrs
      if (row.bookingRunDateFrom)
        propertyPayload.booking_run_date = row.bookingRunDateFrom
      if (row.bookingRevisedDate)
        propertyPayload.booking_revised_date = row.bookingRevisedDate
      if (row.bookingCredentialVerified !== undefined)
        propertyPayload.booking_credential_verified =
          row.bookingCredentialVerified === 'true'
      if (row.bookingOtpNumber)
        propertyPayload.booking_otp_number = row.bookingOtpNumber
      // New Agoda fields
      if (row.agodaServiceFee)
        propertyPayload.agoda_service_fee =
          parseInt(row.agodaServiceFee) || undefined
      if (row.agodaCrs) propertyPayload.agoda_crs = row.agodaCrs
      if (row.agodaRunDateFrom)
        propertyPayload.agoda_run_date = row.agodaRunDateFrom
      if (row.agodaRevisedDate)
        propertyPayload.agoda_revised_date = row.agodaRevisedDate
      if (row.agodaCredentialVerified !== undefined)
        propertyPayload.agoda_credential_verified =
          row.agodaCredentialVerified === 'true'
      if (row.agodaOtpNumber)
        propertyPayload.agoda_otp_number = row.agodaOtpNumber
      // Misc
      if (row.salesRep) propertyPayload.sales_rep = row.salesRep
      if (row.discontinuedEmailIds) {
        propertyPayload.discontinued_email_ids = row.discontinuedEmailIds
          .split(',')
          .map(e => e.trim())
          .filter(Boolean)
      }
      if (row.cybersourceMid)
        propertyPayload.cybersource_mid = row.cybersourceMid
      if (row.adyenLocation) propertyPayload.adyen_location = row.adyenLocation
      if (row.stripeConnectedEmail)
        propertyPayload.stripe_connected_email = row.stripeConnectedEmail
      if (row.isActive !== undefined)
        propertyPayload.is_active = row.isActive === 'true'
      if (row.nextDueDate) {
        const nextDueDate = new Date(`${row.nextDueDate}T00:00:00.000Z`)
        if (!Number.isNaN(nextDueDate.getTime()))
          propertyPayload.next_due_date = nextDueDate
      }

      if (row.serviceTypeName) {
        propertyPayload.service_type_id = await resolveServiceType(
          row.serviceTypeName
        )
      }
      if (row.currency)
        propertyPayload.currency_id = await resolveCurrency(row.currency)

      if (!propertyPayload.expedia_status)
        propertyPayload.expedia_status = 'Access Required'
      if (!propertyPayload.booking_status)
        propertyPayload.booking_status = 'Access Required'
      if (!propertyPayload.agoda_status)
        propertyPayload.agoda_status = 'Access Required'

      const uniqueConflicts = await collectPropertyUniqueConflicts(
        this.prisma,
        {
          name: propertyPayload.name,
          property_identifier: propertyPayload.property_identifier,
          expedia_id: propertyPayload.expedia_id,
          booking_id: propertyPayload.booking_id,
          agoda_id: propertyPayload.agoda_id
        }
      )
      if (uniqueConflicts.length) {
        skippedProperties.push({
          name: propertyName,
          reason: uniqueConflicts.join('; ')
        })
        propertiesSkipped++
        continue
      }

      if (normalizedIdentifier) {
        const identifierKey = propertyIdentifierKey(normalizedIdentifier)
        if (seenIdentifiersInBatch.has(identifierKey)) {
          skippedProperties.push({
            name: propertyName,
            reason: `Duplicate property identifier in import file: ${normalizedIdentifier}`
          })
          propertiesSkipped++
          continue
        }
        seenIdentifiersInBatch.add(identifierKey)
      }

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

        // Create notes if provided (semicolon-separated texts in the Notes column)
        if (userId && row.notes) {
          const noteTexts = row.notes
            .split(';')
            .map(t => t.trim())
            .filter(Boolean)
          if (noteTexts.length > 0) {
            await this.prisma.note.createMany({
              data: noteTexts.map(text => ({
                text,
                property_id: created.id,
                user_id: userId,
                is_done: false
              }))
            })
          }
        }

        // Create credentials if provided
        const credPayload: any = {}
        if (row.expediaUsername)
          credPayload.expediaUsername = row.expediaUsername
        if (row.agodaUsername) credPayload.agodaUsername = row.agodaUsername
        if (row.bookingUsername)
          credPayload.bookingUsername = row.bookingUsername
        if (row.expediaPassword)
          credPayload.expediaPassword = row.expediaPassword
        if (row.bookingPassword)
          credPayload.bookingPassword = row.bookingPassword
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
        logger.error(
          `Error creating property "${propertyName}": ${err.message}`
        )
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
      existingProperties,
      skippedProperties,
      createdPortfolios,
      createdSubportfolios
    }
  }

  async resolveOrCreatePortfolio(
    portfolioName: string,
    logger = new Logger(PropertyRepository.name)
  ): Promise<
    { id: string; name: string; created: boolean } | { error: string }
  > {
    const trimmed = portfolioName?.trim()
    if (!trimmed) {
      return { error: 'Portfolio name is empty' }
    }

    // Case-insensitive, matching every other find-or-create resolver here
    // (processor, service type, billing type, frequency, priority, currency).
    // Portfolio.name is a case-SENSITIVE unique index, so an exact-match
    // lookup would miss "highgate hotels" against a stored "Highgate Hotels"
    // and then happily create a second, near-duplicate portfolio.
    const existing = await this.prisma.portfolio.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true, name: true }
    })
    if (existing) {
      return { id: existing.id, name: existing.name, created: false }
    }

    logger.log(`Portfolio "${trimmed}" not found — creating it`)

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

    try {
      const portfolio = await this.prisma.portfolio.create({
        data: {
          name: trimmed,
          service_type_id: defaultServiceType.id,
          is_active: true,
          is_commissionable: false
        },
        select: { id: true, name: true }
      })
      logger.log(`Portfolio "${trimmed}" created successfully`)
      return { id: portfolio.id, name: portfolio.name, created: true }
    } catch (err: any) {
      logger.error(`Error creating portfolio "${trimmed}": ${err.message}`)
      return { error: `Error creating portfolio: ${err.message}` }
    }
  }

  async bulkDelete(
    ids: string[]
  ): Promise<import('./property.interface').BulkDeleteResult> {
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

  async resolveOrCreateSubportfolio(
    subName: string,
    portfolioId?: string
  ): Promise<{ id: string; created: boolean } | { error: string }> {
    const logger = new Logger(PropertyRepository.name)
    const trimmed = subName.trim()
    if (!trimmed) return { error: 'Subportfolio name is empty' }

    // Case-insensitive for the same reason as resolveOrCreatePortfolio above.
    const subportfolio = await this.prisma.subportfolio.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    })
    if (!subportfolio) {
      try {
        const created = await this.prisma.subportfolio.create({
          data: { name: trimmed, portfolio_id: portfolioId }
        })
        logger.log(`Subportfolio "${trimmed}" created during import`)
        return { id: created.id, created: true }
      } catch (err: any) {
        logger.error(`Error creating subportfolio "${trimmed}": ${err.message}`)
        return { error: `Error creating subportfolio: ${err.message}` }
      }
    }
    // Subportfolios are standalone labels — a property may reference an existing
    // subportfolio regardless of which portfolio (if any) it was originally
    // created under. No ownership check here; just resolve and use it.
    return { id: subportfolio.id, created: false }
  }
}
