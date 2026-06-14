import { Module } from '@nestjs/common'
import { OtaAccessNotificationService } from './ota-access-notification.service'
import { PrismaService } from '../prisma/prisma.service'
import { EmailUtil } from '../../common/utils/email.util'
import { NotificationEmailModule } from '../notification-email/notification-email.module'

@Module({
  imports: [NotificationEmailModule],
  providers: [OtaAccessNotificationService, PrismaService, EmailUtil],
  exports: [OtaAccessNotificationService]
})
export class OtaAccessNotificationModule {}
