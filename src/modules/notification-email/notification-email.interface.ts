import { NotificationEmail } from '@prisma/client'

export interface INotificationEmailRepository {
  getSetting(): Promise<NotificationEmail>
  toggle(): Promise<NotificationEmail>
}

export interface INotificationEmailService {
  getSetting(): Promise<NotificationEmail>
  toggle(): Promise<NotificationEmail>
}
