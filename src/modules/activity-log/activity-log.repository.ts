import { Inject, Injectable, Logger } from '@nestjs/common'
import { ActivityLog } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { IActivityLogRepository } from './activity-log.interface'

@Injectable()
export class ActivityLogRepository implements IActivityLogRepository {
  private readonly logger = new Logger(ActivityLogRepository.name)

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: {
    username: string
    role: string
    roleId: string | null
    endpoint: string
    success: boolean
    statusCode: number
    ipAddress: string
    resource: string
    responseTime: number
  }): Promise<ActivityLog> {
    return this.prisma.activityLog.create({ data })
  }

  async findAll(
    query?: Record<string, any>
  ): Promise<{ data: ActivityLog[]; metadata: any }> {
    try {
      const {
        page,
        limit,
        sortBy,
        sortOrder,
        search,
        start_date,
        end_date,
        success,
        role,
        roleId,
        resource,
        ...filters
      } = query || {}

      const skip = page
        ? (parseInt(page || '1') - 1) * parseInt(limit || '10')
        : 0
      const take = limit ? parseInt(limit) : 10

      const orderBy = sortBy
        ? { [sortBy || 'timestamp']: sortOrder?.toLowerCase() === 'desc' ? 'desc' : 'asc' }
        : { timestamp: 'desc' as const }

      const additionalConditions: any[] = []

      if (search) {
        additionalConditions.push({
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { endpoint: { contains: search, mode: 'insensitive' } }
          ]
        })
      }

      if (start_date && end_date) {
        additionalConditions.push({
          timestamp: {
            gte: new Date(start_date),
            lte: new Date(end_date)
          }
        })
      }

      if (success !== undefined) {
        additionalConditions.push({ success })
      }

      if (role) {
        additionalConditions.push({ role })
      }

      if (roleId) {
        additionalConditions.push({ roleId })
      }

      if (resource) {
        additionalConditions.push({ resource })
      }

      const allFilters =
        additionalConditions.length > 0
          ? { ...filters, AND: additionalConditions }
          : filters

      const [data, totalDocuments] = await Promise.all([
        this.prisma.activityLog.findMany({
          skip,
          take,
          orderBy,
          where: allFilters
        }),
        this.prisma.activityLog.count({ where: allFilters })
      ])

      const metadata = {
        totalDocuments,
        currentPage: page ? parseInt(page) : 1,
        limit: take,
        totalPage: Math.ceil(totalDocuments / take)
      }

      return { data, metadata }
    } catch (error) {
      this.logger.error('Error fetching activity logs:', error)
      return { data: [], metadata: null }
    }
  }

  async delete(id: string): Promise<ActivityLog> {
    return this.prisma.activityLog.delete({ where: { id } })
  }

  async deleteMany(): Promise<{ count: number }> {
    return this.prisma.activityLog.deleteMany({})
  }
}