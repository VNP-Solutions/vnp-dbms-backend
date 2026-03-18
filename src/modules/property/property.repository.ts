import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePropertyDto, UpdatePropertyDto } from './property.dto'
import type { IPropertyRepository, PropertyWithRelations } from './property.interface'

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
      address: data.address,
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
}
