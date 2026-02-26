import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EmailAttachment, SendEmailDto } from './email.dto'

export interface IEmailService {
  sendEmail(
    data: SendEmailDto,
    user: IUserWithPermissions,
    attachments?: EmailAttachment[]
  ): Promise<{ message: string }>
}
