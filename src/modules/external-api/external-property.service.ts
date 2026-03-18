import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProjectType } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { getProjectAccessibleResources } from '../../common/utils/project-context.util'
import type { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type { ExternalApiQueryDto, ExternalPropertyDto, UpdatePropertyCredentialsExternalDto } from './external-api.dto'

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

  private decryptCredentials(credentials: any) {
    if (!credentials) return undefined

    return {
      id: credentials.id,
      property_id: credentials.property_id,
      expediaUsername: credentials.expediaUsername || undefined,
      expediaPassword: credentials.expediaPassword
        ? EncryptionUtil.decrypt(credentials.expediaPassword, this.encryptionSecret)
        : undefined,
      agodaUsername: credentials.agodaUsername || undefined,
      agodaPassword: credentials.agodaPassword
        ? EncryptionUtil.decrypt(credentials.agodaPassword, this.encryptionSecret)
        : undefined,
      bookingUsername: credentials.bookingUsername || undefined,
      bookingPassword: credentials.bookingPassword
        ? EncryptionUtil.decrypt(credentials.bookingPassword, this.encryptionSecret)
        : undefined,
      expediaEmailAssociated: credentials.expediaEmailAssociated || undefined,
      propertyContactEmail: credentials.propertyContactEmail || undefined,
      portfolioContactEmail: credentials.portfolioContactEmail || undefined,
      multiplePortfolioEmails: credentials.multiplePortfolioEmails || undefined,
      case_contact_email: credentials.case_contact_email || undefined,
      case_contact_name: credentials.case_contact_name || undefined,
      case_contact_phone: credentials.case_contact_phone || undefined,
      reporting_contact_name: credentials.reporting_contact_name || undefined,
      reporting_contact_email: credentials.reporting_contact_email || undefined,
      reporting_contact_phone: credentials.reporting_contact_phone || undefined
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
        ...(includeCredentials && {
          credentials: true
        })
      }
    })

    return properties.map(property => ({
      id: property.id,
      name: property.name,
      card_descriptor: property.card_descriptor || undefined,
      is_active: property.is_active,
      next_due_date: property.next_due_date?.toISOString(),
      portfolio_id: property.portfolio.id,
      portfolio_name: property.portfolio.name,
      subportfolio_id: property.subportfolio?.id,
      subportfolio_name: property.subportfolio?.name,
      previous_portfolio_id: property.previous_portfolio_id || undefined,
      show_in_portfolio: property.show_in_portfolio.length > 0 ? property.show_in_portfolio : undefined,
      new_domain_email: property.new_domain_email || undefined,
      others_case_emails: property.others_case_emails.length > 0 ? property.others_case_emails : undefined,
      primary_case_email: property.primary_case_email || undefined,
      portfolio_contact_email: (property as any).portfolio_contact_email || undefined,
      webmail_password:
        property.webmail_password
          ? this.safeDecrypt(property.webmail_password)
          : undefined,
      description: property.description || undefined,
      hotel_address: property.hotel_address || undefined,
      qp_username: property.qp_username || undefined,
      qp_password: property.qp_password ? EncryptionUtil.decrypt(property.qp_password, this.encryptionSecret) : undefined,
      qp_api_key: property.qp_api_key ? EncryptionUtil.decrypt(property.qp_api_key, this.encryptionSecret) : undefined,
      expedia_id: property.expedia_id || undefined,
      expedia_status: property.expedia_status || undefined,
      booking_id: property.booking_id || undefined,
      booking_status: property.booking_status || undefined,
      agoda_id: property.agoda_id || undefined,
      agoda_status: property.agoda_status || undefined,
      created_at: property.created_at.toISOString(),
      updated_at: property.updated_at.toISOString(),
      credentials: includeCredentials && (property as any).credentials?.[0]
        ? this.decryptCredentials((property as any).credentials[0])
        : undefined
    }))
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

    return {
      id: property.id,
      name: property.name,
      card_descriptor: property.card_descriptor || undefined,
      is_active: property.is_active,
      next_due_date: property.next_due_date?.toISOString(),
      portfolio_id: property.portfolio.id,
      portfolio_name: property.portfolio.name,
      subportfolio_id: property.subportfolio?.id,
      subportfolio_name: property.subportfolio?.name,
      previous_portfolio_id: property.previous_portfolio_id || undefined,
      show_in_portfolio: property.show_in_portfolio.length > 0 ? property.show_in_portfolio : undefined,
      new_domain_email: property.new_domain_email || undefined,
      others_case_emails: property.others_case_emails.length > 0 ? property.others_case_emails : undefined,
      primary_case_email: property.primary_case_email || undefined,
      portfolio_contact_email: (property as any).portfolio_contact_email || undefined,
      webmail_password:
        property.webmail_password
          ? this.safeDecrypt(property.webmail_password)
          : undefined,
      description: property.description || undefined,
      hotel_address: property.hotel_address || undefined,
      qp_username: property.qp_username || undefined,
      qp_password: property.qp_password ? EncryptionUtil.decrypt(property.qp_password, this.encryptionSecret) : undefined,
      qp_api_key: property.qp_api_key ? EncryptionUtil.decrypt(property.qp_api_key, this.encryptionSecret) : undefined,
      expedia_id: property.expedia_id || undefined,
      expedia_status: property.expedia_status || undefined,
      booking_id: property.booking_id || undefined,
      booking_status: property.booking_status || undefined,
      agoda_id: property.agoda_id || undefined,
      agoda_status: property.agoda_status || undefined,
      created_at: property.created_at.toISOString(),
      updated_at: property.updated_at.toISOString(),
      credentials: includeCredentials && (property as any).credentials?.[0]
        ? this.decryptCredentials((property as any).credentials[0])
        : undefined
    }
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
