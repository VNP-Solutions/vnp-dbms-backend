import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationEmailController } from './notification-email.controller'
import { NotificationEmailRepository } from './notification-email.repository'
import { NotificationEmailService } from './notification-email.service'

@Module({
  controllers: [NotificationEmailController],
  providers: [
    { provide: 'INotificationEmailService', useClass: NotificationEmailService },
    { provide: 'INotificationEmailRepository', useClass: NotificationEmailRepository },
    PermissionService,
    PrismaService
  ],
  exports: [{ provide: 'INotificationEmailService', useClass: NotificationEmailService }]
})
export class NotificationEmailModule {}
