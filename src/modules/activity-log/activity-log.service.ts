import { Inject, Injectable } from '@nestjs/common'
import type { IActivityLogRepository, IActivityLogService } from './activity-log.interface'

@Injectable()
export class ActivityLogService implements IActivityLogService {
  constructor(
    @Inject('IActivityLogRepository')
    private readonly activityLogRepository: IActivityLogRepository
  ) {}

  async logActivity(data: {
    username: string
    role: string
    endpoint: string
    success: boolean
    statusCode: number
    ipAddress: string
    resource: string
    responseTime: number
  }) {
    try {
      await this.activityLogRepository.create(data)
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
  }

  async getAllLogs(page = 1, limit = 10, query?: Record<string, any>) {
    return this.activityLogRepository.findAll({ page, limit, ...query })
  }

  async deleteLog(id: string) {
    return this.activityLogRepository.delete(id)
  }

  async deleteAllLogs() {
    return this.activityLogRepository.deleteMany()
  }
}