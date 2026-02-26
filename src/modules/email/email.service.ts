import { Inject, Injectable } from '@nestjs/common'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { EmailAttachment, SendEmailDto } from './email.dto'
import type { IEmailService } from './email.interface'

@Injectable()
export class EmailService implements IEmailService {
  constructor(
    @Inject(EmailUtil) private emailUtil: EmailUtil,
    @Inject(PrismaService) private prisma: PrismaService
  ) {}

  async sendEmail(
    data: SendEmailDto,
    user: IUserWithPermissions,
    uploadedAttachments?: EmailAttachment[]
  ) {
    // Default send_sender_data to true if not specified
    const shouldSendSenderData = data.send_sender_data !== false

    // Build the email body
    let fullEmailBody = data.body

    // Append sender information if requested
    if (shouldSendSenderData) {
      const senderInfo = await this.buildSenderInfo(user.id, user)
      fullEmailBody = `${data.body}\n\n${senderInfo}`
    }

    // Combine attachments from file uploads and URLs
    let allAttachments: EmailAttachment[] = []

    // Add uploaded file attachments if provided
    if (uploadedAttachments && uploadedAttachments.length > 0) {
      allAttachments = [...uploadedAttachments]
    }

    // Fetch and add URL-based attachments if provided
    if (data.attachment_urls && data.attachment_urls.length > 0) {
      const urlAttachments =
        await this.emailUtil.fetchAttachmentsFromUrls(data.attachment_urls)
      allAttachments = [...allAttachments, ...urlAttachments]
    }

    // Remove duplicates and filter empty values
    const recipients = [...new Set(data.to.filter(email => email && email.trim()))]

    if (recipients.length === 0) {
      return { message: 'No valid recipient emails provided' }
    }

    // Send the email to all recipients
    await this.emailUtil.sendEmail(
      recipients,
      data.subject,
      fullEmailBody,
      allAttachments.length > 0 ? allAttachments : undefined
    )

    return {
      message: `Email sent successfully to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`
    }
  }

  private async buildSenderInfo(
    userId: string,
    user: IUserWithPermissions
  ): Promise<string> {
    // Query database to get full user details
    const fullUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        first_name: true,
        last_name: true,
        email: true
      }
    })

    const divider = '-----------------------------------'
    const senderDetails = [
      divider,
      'This email was sent by:',
      '',
      `Name: ${fullUser?.first_name} ${fullUser?.last_name}`,
      `Email: ${fullUser?.email || user.email}`,
      `Role: ${user.role.name}`
    ]

    return senderDetails.join('\n')
  }
}
