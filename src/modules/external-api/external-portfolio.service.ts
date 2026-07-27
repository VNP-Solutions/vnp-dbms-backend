import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProjectType } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { getProjectAccessibleResources } from '../../common/utils/project-context.util'
import type { Configuration } from '../../config/configuration'
import { PrismaService } from '../prisma/prisma.service'
import type {
  BulkUpdatePortfolioBookingCredentialsDto,
  ExternalApiQueryDto,
  ExternalPortfolioDto
} from './external-api.dto'

@Injectable()
export class ExternalPortfolioService {
  private readonly encryptionSecret: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Configuration, true>
  ) {
    this.encryptionSecret = this.configService.get('encryption.secret', {
      infer: true
    })
  }

  async findAllForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    query: ExternalApiQueryDto
  ): Promise<ExternalPortfolioDto[]> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    let portfolioIds: string[] = []
    if (accessibleResources.portfolio_ids === 'all') {
      portfolioIds = []
    } else if (Array.isArray(accessibleResources.portfolio_ids)) {
      portfolioIds = accessibleResources.portfolio_ids
    }

    if (query.portfolio_ids && query.portfolio_ids.length > 0) {
      if (portfolioIds.length > 0) {
        portfolioIds = portfolioIds.filter(id => query.portfolio_ids!.includes(id))
      } else {
        portfolioIds = query.portfolio_ids
      }
    }

    const where: any = {}
    if (portfolioIds.length > 0) {
      where.id = { in: portfolioIds }
    }
    if (query.is_active !== undefined) {
      where.is_active = query.is_active
    }

    const portfolios = await this.prisma.portfolio.findMany({
      where,
      include: {
        service_type: true,
        subportfolios: {
          select: { id: true }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    return portfolios.map(portfolio => ({
      id: portfolio.id,
      name: portfolio.name,
      service_type: portfolio.service_type?.type ?? '',
      is_active: portfolio.is_active,
      contact_email: portfolio.contact_email ?? null,
      portfolio_contact_email: portfolio.portfolio_contact_email ?? null,
      portfolio_contact_name: portfolio.portfolio_contact_name ?? null,
      portfolio_contact_phone: portfolio.portfolio_contact_phone ?? null,
      is_commissionable: portfolio.is_commissionable,
      commission: portfolio.commission ?? null,
      attachment: portfolio.attachment ?? null,
      attachments: portfolio.attachments ?? [],
      contract_signed: portfolio.contract_signed ?? null,
      created_at: portfolio.created_at.toISOString(),
      updated_at: portfolio.updated_at.toISOString(),
      total_properties: portfolio.properties.length,
      total_subportfolios: portfolio.subportfolios.length
    }))
  }

  async findOneForExternalProject(
    user: IUserWithProjectRole,
    projectType: ProjectType,
    portfolioId: string,
    _includeCredentials = true
  ): Promise<ExternalPortfolioDto | null> {
    const accessibleResources = getProjectAccessibleResources(user, projectType)

    if (
      accessibleResources.portfolio_ids !== 'all' &&
      !accessibleResources.portfolio_ids.includes(portfolioId)
    ) {
      return null
    }

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        service_type: true,
        subportfolios: {
          select: { id: true }
        },
        properties: {
          select: { id: true }
        }
      }
    })

    if (!portfolio) {
      return null
    }

    return {
      id: portfolio.id,
      name: portfolio.name,
      service_type: portfolio.service_type?.type ?? '',
      is_active: portfolio.is_active,
      contact_email: portfolio.contact_email ?? null,
      portfolio_contact_email: portfolio.portfolio_contact_email ?? null,
      portfolio_contact_name: portfolio.portfolio_contact_name ?? null,
      portfolio_contact_phone: portfolio.portfolio_contact_phone ?? null,
      is_commissionable: portfolio.is_commissionable,
      commission: portfolio.commission ?? null,
      attachment: portfolio.attachment ?? null,
      attachments: portfolio.attachments ?? [],
      contract_signed: portfolio.contract_signed ?? null,
      created_at: portfolio.created_at.toISOString(),
      updated_at: portfolio.updated_at.toISOString(),
      total_properties: portfolio.properties.length,
      total_subportfolios: portfolio.subportfolios.length
    }
  }

  /**
   * Accepts a property ID, resolves its parent portfolio, then updates
   * Booking.com credentials for every property in that portfolio whose
   * stored `bookingUsername` matches the one supplied in the request body.
   * Properties with no credentials record or a different username are skipped.
   */
  async bulkUpdateBookingCredentialsByPortfolio(
    propertyId: string,
    dto: BulkUpdatePortfolioBookingCredentialsDto
  ): Promise<{
    message: string
    updated_count: number
    skipped_count: number
    portfolio_id: string
  }> {
    // Resolve the property → portfolio
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, portfolio_id: true }
    })

    if (!property) {
      throw new NotFoundException(`Property "${propertyId}" not found`)
    }

    const portfolioId = property.portfolio_id

    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: { id: true, properties: { select: { id: true } } }
    })

    if (!portfolio) {
      throw new NotFoundException(`Portfolio "${portfolioId}" not found`)
    }

    // Build the update payload — only booking password, encrypted
    const updateData: Record<string, any> = {}
    if (dto.bookingPassword) {
      updateData.bookingPassword = EncryptionUtil.encrypt(
        dto.bookingPassword,
        this.encryptionSecret
      )
    }

    let updatedCount = 0
    let skippedCount = 0

    for (const { id: propertyId } of portfolio.properties) {
      const existing = await this.prisma.propertyCredentials.findFirst({
        where: { property_id: propertyId },
        select: { id: true, bookingUsername: true }
      })

      // Skip if no credentials exist or bookingUsername does not match
      if (!existing || existing.bookingUsername !== dto.bookingUsername) {
        skippedCount++
        continue
      }

      if (Object.keys(updateData).length > 0) {
        await this.prisma.propertyCredentials.update({
          where: { id: existing.id },
          data: updateData
        })
      }

      updatedCount++
    }

    return {
      message: `Booking credentials updated for ${updatedCount} propert${updatedCount === 1 ? 'y' : 'ies'} (${skippedCount} skipped — username mismatch or no credentials)`,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      portfolio_id: portfolioId
    }
  }
}
