import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProjectType } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { getProjectAccessibleResources } from '../../common/utils/project-context.util'
import type { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type { DecryptedPropertyCredential, ExternalApiQueryDto, ExternalPropertyDto, UpdatePropertyCredentialsExternalDto } from './external-api.dto'

const relationIncludes = {
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
}

@Injectable()
export class ExternalPropertyService {
  private readonly encryptionSecret: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Configuration, true>
  ) {
    this.encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })
  }

  private safeDecrypt(encrypted: string): string {
    try {
      return EncryptionUtil.decrypt(encrypted, this.encryptionSecret)
    } catch {
      return encrypted
    }
  }

  private decryptCredentials(credentials: any): DecryptedPropertyCredential | null {
    if (!credentials) return null

    return {
      id: credentials.id,
      property_id: credentials.property_id,
      expediaUsername: credentials.expediaUsername ?? null,
      expediaPassword: credentials.expediaPassword
        ? this.safeDecrypt(credentials.expediaPassword)
        : null,
      agodaUsername: credentials.agodaUsername ?? null,
      agodaPassword: credentials.agodaPassword
        ? this.safeDecrypt(credentials.agodaPassword)
        : null,
      bookingUsername: credentials.bookingUsername ?? null,
      bookingPassword: credentials.bookingPassword
        ? this.safeDecrypt(credentials.bookingPassword)
        : null,
      expediaSecondaryUsername: credentials.expediaSecondaryUsername ?? null,
      expediaSecondaryPassword: credentials.expediaSecondaryPassword
        ? this.safeDecrypt(credentials.expediaSecondaryPassword)
        : null,
      bookingSecondaryUsername: credentials.bookingSecondaryUsername ?? null,
      bookingSecondaryPassword: credentials.bookingSecondaryPassword
        ? this.safeDecrypt(credentials.bookingSecondaryPassword)
        : null,
      agodaSecondaryUsername: credentials.agodaSecondaryUsername ?? null,
      agodaSecondaryPassword: credentials.agodaSecondaryPassword
        ? this.safeDecrypt(credentials.agodaSecondaryPassword)
        : null,
      expediaEmailAssociated: credentials.expediaEmailAssociated ?? null,
      propertyContactEmail: credentials.propertyContactEmail ?? null,
      portfolioContactEmail: credentials.portfolioContactEmail ?? null,
      multiplePortfolioEmails: credentials.multiplePortfolioEmails ?? [],
      case_contact_email: credentials.case_contact_email ?? null,
      case_contact_name: credentials.case_contact_name ?? null,
      case_contact_phone: credentials.case_contact_phone ?? null,
      reporting_contact_name: credentials.reporting_contact_name ?? null,
      reporting_contact_email: credentials.reporting_contact_email ?? null,
      reporting_contact_phone: credentials.reporting_contact_phone ?? null,
      created_at: credentials.created_at?.toISOString?.() ?? credentials.created_at,
      updated_at: credentials.updated_at?.toISOString?.() ?? credentials.updated_at
    }
  }

  private mapPropertyToExternalDto(property: any, includeCredentials: boolean): ExternalPropertyDto {
    return {
      id: property.id,
      name: property.name,
      card_descriptor: property.card_descriptor ?? null,
      is_active: property.is_active,
      next_due_date: property.next_due_date?.toISOString() ?? null,
      portfolio_id: property.portfolio.id,
      portfolio_name: property.portfolio.name,
      service_type: property.service_type?.type ?? null,
      subportfolio_id: property.subportfolio?.id ?? null,
      subportfolio_name: property.subportfolio?.name ?? null,
      previous_portfolio_id: property.previous_portfolio_id ?? null,
      show_in_portfolio: property.show_in_portfolio.length > 0 ? property.show_in_portfolio : [],
      new_domain_email: property.new_domain_email ?? null,
      others_case_emails: property.others_case_emails.length > 0 ? property.others_case_emails : [],
      primary_case_email: property.primary_case_email ?? null,
      portfolio_contact_email: property.portfolio_contact_email ?? null,
      portfolio_contact: property.portfolio_contact ?? null,
      webmail_password: property.webmail_password
        ? this.safeDecrypt(property.webmail_password)
        : null,
      description: property.description ?? null,
      hotel_address: property.hotel_address ?? null,
      property_identifier: property.property_identifier ?? null,
      case_management_contact: property.case_management_contact ?? null,
      access_contact: property.access_contact ?? null,
      reporting_contact: property.reporting_contact ?? null,
      expedia_processor: property.expedia_processor?.name ?? null,
      booking_processor: property.booking_processor?.name ?? null,
      agoda_processor: property.agoda_processor?.name ?? null,
      from: property.from ?? null,
      to: property.to ?? null,
      qp_username: property.qp_username ?? null,
      qp_password: property.qp_password ? EncryptionUtil.decrypt(property.qp_password, this.encryptionSecret) : null,
      qp_api_key: property.qp_api_key ? EncryptionUtil.decrypt(property.qp_api_key, this.encryptionSecret) : null,
      fp_mid: property.fp_mid ?? null,
      fp_username: property.fp_username ?? null,
      fp_password: property.fp_password ? this.safeDecrypt(property.fp_password) : null,
      stripe_account_email: property.stripe_account_email ?? null,
      expedia_id: property.expedia_id ?? null,
      expedia_status: property.expedia_status ?? null,
      booking_id: property.booking_id ?? null,
      booking_status: property.booking_status ?? null,
      agoda_id: property.agoda_id ?? null,
      agoda_status: property.agoda_status ?? null,
      expedia_billing_type: property.expedia_billing_type?.name ?? null,
      expedia_service_type: property.expedia_service_type?.type ?? null,
      expedia_frequency: property.expedia_frequency?.name ?? null,
      expedia_access_level: property.expedia_access_level ?? null,
      expedia_from: property.expedia_from ?? null,
      expedia_to: property.expedia_to ?? null,
      expedia_scheduler: property.expedia_scheduler ?? null,
      expedia_duration: property.expedia_duration ?? null,
      expedia_db_duration: property.expedia_db_duration ?? null,
      expedia_service_fee: property.expedia_service_fee ?? null,
      expedia_priority: property.expedia_priority ?? null,
      expedia_crs: property.expedia_crs ?? null,
      expedia_crs_db: property.expedia_crs_db ?? null,
      expedia_run_date_from: property.expedia_run_date_from ?? null,
      expedia_run_date_to: property.expedia_run_date_to ?? null,
      expedia_run_date_db_from: property.expedia_run_date_db_from ?? null,
      expedia_run_date_db_to: property.expedia_run_date_db_to ?? null,
      expedia_revised_date: property.expedia_revised_date ?? null,
      expedia_scheduler_review_from: property.expedia_scheduler_review_from ?? null,
      expedia_scheduler_review_to: property.expedia_scheduler_review_to ?? null,
      expedia_scheduler_db: property.expedia_scheduler_db ?? null,
      expedia_scheduler_review_db_from: property.expedia_scheduler_review_db_from ?? null,
      expedia_scheduler_review_db_to: property.expedia_scheduler_review_db_to ?? null,
      expedia_credential_verified: property.expedia_credential_verified ?? null,
      expedia_otp_number: property.expedia_otp_number ?? null,
      from_db: property.from_db ?? null,
      to_db: property.to_db ?? null,
      booking_billing_type: property.booking_billing_type?.name ?? null,
      booking_service_type: property.booking_service_type?.type ?? null,
      booking_frequency: property.booking_frequency?.name ?? null,
      booking_access_level: property.booking_access_level ?? null,
      booking_from: property.booking_from ?? null,
      booking_to: property.booking_to ?? null,
      booking_scheduler: property.booking_scheduler ?? null,
      booking_duration: property.booking_duration ?? null,
      booking_service_fee: property.booking_service_fee ?? null,
      booking_priority: property.booking_priority ?? null,
      booking_crs: property.booking_crs ?? null,
      booking_run_date: property.booking_run_date ?? null,
      booking_revised_date: property.booking_revised_date ?? null,
      booking_credential_verified: property.booking_credential_verified ?? null,
      booking_otp_number: property.booking_otp_number ?? null,
      agoda_billing_type: property.agoda_billing_type?.name ?? null,
      agoda_service_type: property.agoda_service_type?.type ?? null,
      agoda_frequency: property.agoda_frequency?.name ?? null,
      agoda_access_level: property.agoda_access_level ?? null,
      agoda_from: property.agoda_from ?? null,
      agoda_to: property.agoda_to ?? null,
      agoda_scheduler: property.agoda_scheduler ?? null,
      agoda_duration: property.agoda_duration ?? null,
      agoda_service_fee: property.agoda_service_fee ?? null,
      agoda_priority: property.agoda_priority ?? null,
      agoda_crs: property.agoda_crs ?? null,
      agoda_run_date: property.agoda_run_date ?? null,
      agoda_revised_date: property.agoda_revised_date ?? null,
      agoda_credential_verified: property.agoda_credential_verified ?? null,
      agoda_otp_number: property.agoda_otp_number ?? null,
      sales_rep: property.sales_rep ?? null,
      need_another_domain: property.need_another_domain ?? null,
      booking_otp_phone: property.booking_otp_phone ?? null,
      created_at: property.created_at.toISOString(),
      updated_at: property.updated_at.toISOString(),
      credentials: (includeCredentials && property.credentials?.[0]
        ? this.decryptCredentials(property.credentials[0])
        : null)
    }
  }

  async findAllForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    query: ExternalApiQueryDto
  ): Promise<ExternalPropertyDto[]> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    const where: any = {}

    if (accessibleResources.property_ids !== 'all') {
      if (accessibleResources.property_ids.length === 0) {
        return []
      }
      where.id = { in: accessibleResources.property_ids }
    }

    if (accessibleResources.portfolio_ids !== 'all') {
      if (accessibleResources.portfolio_ids.length === 0) {
        return []
      }
      where.portfolio_id = { in: accessibleResources.portfolio_ids }
    }

    if (query.portfolio_ids && query.portfolio_ids.length > 0) {
      where.portfolio_id = { in: query.portfolio_ids }
    }

    if (query.subportfolio_ids && query.subportfolio_ids.length > 0) {
      where.subportfolio_id = { in: query.subportfolio_ids }
    }

    if (query.property_ids && query.property_ids.length > 0) {
      if (where.id) {
        where.id.in = where.id.in.filter((id: string) =>
          query.property_ids!.includes(id)
        )
      } else {
        where.id = { in: query.property_ids }
      }
    }

    if (query.is_active !== undefined) {
      where.is_active = query.is_active
    }

    const includeCredentials = query.include_credentials ?? false

    const properties = await this.prisma.property.findMany({
      where,
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        subportfolio: {
          select: {
            id: true,
            name: true
          }
        },
        ...relationIncludes,
        ...(includeCredentials && {
          credentials: true
        })
      }
    })

    return properties.map(property => this.mapPropertyToExternalDto(property, includeCredentials))
  }

  async findOneForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    propertyId: string,
    includeCredentials = true
  ): Promise<ExternalPropertyDto | null> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    if (
      accessibleResources.property_ids !== 'all' &&
      !accessibleResources.property_ids.includes(propertyId)
    ) {
      return null
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true
          }
        },
        subportfolio: {
          select: {
            id: true,
            name: true
          }
        },
        ...relationIncludes,
        ...(includeCredentials && {
          credentials: true
        })
      }
    })

    if (!property) {
      return null
    }

    if (
      accessibleResources.portfolio_ids !== 'all' &&
      !accessibleResources.portfolio_ids.includes(property.portfolio_id)
    ) {
      return null
    }

    return this.mapPropertyToExternalDto(property, includeCredentials)
  }

  async findByOtaIdForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    otaChannel: 'expedia' | 'booking' | 'agoda',
    otaId: string
  ): Promise<ExternalPropertyDto | null> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    const fieldMap = {
      expedia: 'expedia_id',
      booking: 'booking_id',
      agoda: 'agoda_id'
    } as const

    const where: any = {
      [fieldMap[otaChannel]]: otaId
    }

    if (accessibleResources.property_ids !== 'all') {
      if (accessibleResources.property_ids.length === 0) return null
      where.id = { in: accessibleResources.property_ids }
    }

    if (accessibleResources.portfolio_ids !== 'all') {
      if (accessibleResources.portfolio_ids.length === 0) return null
      where.portfolio_id = { in: accessibleResources.portfolio_ids }
    }

    const property = await this.prisma.property.findFirst({
      where,
      include: {
        portfolio: { select: { id: true, name: true } },
        subportfolio: { select: { id: true, name: true } },
        ...relationIncludes,
        credentials: true
      }
    })

    if (!property) return null

    return this.mapPropertyToExternalDto(property, true)
  }

  async findByPortfolioForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    portfolioId: string
  ): Promise<ExternalPropertyDto[]> {
    return this.findAllForExternalProject(user, projectType, {
      portfolio_ids: [portfolioId]
    })
  }

  async findBySubportfolioForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    subportfolioId: string
  ): Promise<ExternalPropertyDto[]> {
    return this.findAllForExternalProject(user, projectType, {
      subportfolio_ids: [subportfolioId]
    })
  }

  async updateCredentialsForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    propertyId: string,
    credentialsData: UpdatePropertyCredentialsExternalDto
  ): Promise<{ message: string; credentials?: any }> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    // Check if user has access to this property
    if (
      accessibleResources.property_ids !== 'all' &&
      !accessibleResources.property_ids.includes(propertyId)
    ) {
      throw new NotFoundException('Property not found or access denied')
    }

    // Verify property exists and user has portfolio access
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, portfolio_id: true }
    })

    if (!property) {
      throw new NotFoundException('Property not found')
    }

    if (
      accessibleResources.portfolio_ids !== 'all' &&
      !accessibleResources.portfolio_ids.includes(property.portfolio_id)
    ) {
      throw new NotFoundException('Property not found or access denied')
    }

    // Encrypt passwords before saving
    const encryptedData: any = {}

    if (credentialsData.expediaUsername !== undefined) {
      encryptedData.expediaUsername = credentialsData.expediaUsername
    }
    if (credentialsData.expediaPassword) {
      encryptedData.expediaPassword = EncryptionUtil.encrypt(
        credentialsData.expediaPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.agodaUsername !== undefined) {
      encryptedData.agodaUsername = credentialsData.agodaUsername
    }
    if (credentialsData.agodaPassword) {
      encryptedData.agodaPassword = EncryptionUtil.encrypt(
        credentialsData.agodaPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.bookingUsername !== undefined) {
      encryptedData.bookingUsername = credentialsData.bookingUsername
    }
    if (credentialsData.bookingPassword) {
      encryptedData.bookingPassword = EncryptionUtil.encrypt(
        credentialsData.bookingPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.expediaSecondaryUsername !== undefined) {
      encryptedData.expediaSecondaryUsername = credentialsData.expediaSecondaryUsername
    }
    if (credentialsData.expediaSecondaryPassword) {
      encryptedData.expediaSecondaryPassword = EncryptionUtil.encrypt(
        credentialsData.expediaSecondaryPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.bookingSecondaryUsername !== undefined) {
      encryptedData.bookingSecondaryUsername = credentialsData.bookingSecondaryUsername
    }
    if (credentialsData.bookingSecondaryPassword) {
      encryptedData.bookingSecondaryPassword = EncryptionUtil.encrypt(
        credentialsData.bookingSecondaryPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.agodaSecondaryUsername !== undefined) {
      encryptedData.agodaSecondaryUsername = credentialsData.agodaSecondaryUsername
    }
    if (credentialsData.agodaSecondaryPassword) {
      encryptedData.agodaSecondaryPassword = EncryptionUtil.encrypt(
        credentialsData.agodaSecondaryPassword,
        this.encryptionSecret
      )
    }

    if (credentialsData.expediaEmailAssociated !== undefined) {
      encryptedData.expediaEmailAssociated = credentialsData.expediaEmailAssociated
    }
    if (credentialsData.propertyContactEmail !== undefined) {
      encryptedData.propertyContactEmail = credentialsData.propertyContactEmail
    }
    if (credentialsData.portfolioContactEmail !== undefined) {
      encryptedData.portfolioContactEmail = credentialsData.portfolioContactEmail
    }
    if (credentialsData.multiplePortfolioEmails !== undefined) {
      encryptedData.multiplePortfolioEmails = credentialsData.multiplePortfolioEmails
    }

    // Check if credentials exist
    const existingCredentials = await this.prisma.propertyCredentials.findFirst({
      where: { property_id: propertyId }
    })

    let updatedCredentials

    if (existingCredentials) {
      // Update existing credentials
      updatedCredentials = await this.prisma.propertyCredentials.update({
        where: { id: existingCredentials.id },
        data: encryptedData
      })
    } else {
      // Create new credentials
      updatedCredentials = await this.prisma.propertyCredentials.create({
        data: {
          ...encryptedData,
          property_id: propertyId
        }
      })
    }

    return {
      message: 'Credentials updated successfully',
      credentials: this.decryptCredentials(updatedCredentials)
    }
  }
}
