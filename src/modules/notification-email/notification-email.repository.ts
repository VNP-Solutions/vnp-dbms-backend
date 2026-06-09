import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { INotificationEmailRepository } from './notification-email.interface'

@Injectable()
export class NotificationEmailRepository implements INotificationEmailRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getSetting() {
    let setting = await this.prisma.notificationEmail.findFirst()
    if (!setting) {
      setting = await this.prisma.notificationEmail.create({ data: { is_active: false } })
    }
    return setting
  }

  async toggle() {
    const setting = await this.getSetting()
    return this.prisma.notificationEmail.update({
      where: { id: setting.id },
      data: { is_active: !setting.is_active }
    })
  }
}
