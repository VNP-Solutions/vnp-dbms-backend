import { Inject, Injectable } from '@nestjs/common'
import type { INotificationEmailRepository, INotificationEmailService } from './notification-email.interface'

@Injectable()
export class NotificationEmailService implements INotificationEmailService {
  constructor(
    @Inject('INotificationEmailRepository')
    private readonly repo: INotificationEmailRepository
  ) {}

  getSetting() {
    return this.repo.getSetting()
  }

  toggle() {
    return this.repo.toggle()
  }
}
