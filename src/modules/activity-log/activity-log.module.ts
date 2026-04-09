import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ActivityLogController } from './activity-log.controller'
import { ActivityLogRepository } from './activity-log.repository'
import { ActivityLogService } from './activity-log.service'

@Module({
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    {
      provide: 'IActivityLogService',
      useClass: ActivityLogService
    },
    {
      provide: 'IActivityLogRepository',
      useClass: ActivityLogRepository
    },
    PrismaService
  ],
  exports: [ActivityLogService]
})
export class ActivityLogModule {}
