import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EmailUtil } from '../../common/utils/email.util'
import type { INotificationEmailService } from '../notification-email/notification-email.interface'

@Injectable()
export class OtaAccessNotificationService {
  private readonly logger = new Logger(OtaAccessNotificationService.name)

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailUtil) private readonly emailUtil: EmailUtil,
    @Inject('INotificationEmailService')
    private readonly notificationEmailService: INotificationEmailService
  ) {}

  // Cron schedule for every Friday at 9:00 AM (0 0 9 * * 5)
  // @Cron('0 55 16 * * 0', { timeZone: 'Asia/Dhaka' })
  @Cron('0 0 9 * * 5')
  async handleFridayOtaAccessCheck() {
    this.logger.log('Starting Friday OTA Access Check job...')

    try {
      // 1. Check if notification email is enabled
      const setting = await this.notificationEmailService.getSetting()
      if (!setting.is_active) {
        this.logger.log('Notification emails are disabled. Skipping OTA access notifications.')
        return
      }

      // 2. Use aggregateRaw to bypass Prisma's null-handling limitation on
      //    nullable Boolean fields. Raw MongoDB $ne: true correctly matches
      //    false, null, and absent fields. $project limits the payload to
      //    only the 8 fields this job needs, keeping it efficient at scale.
      const rawResults = await this.prisma.property.aggregateRaw({
        pipeline: [
          {
            $match: {
              is_active: true,
              $or: [
                { expedia_access_level: { $ne: true } },
                { agoda_access_level: { $ne: true } },
                { booking_access_level: { $ne: true } }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              name: 1,
              access_contact: 1,
              portfolio_contact_email: 1,
              portfolio_contact: 1,
              expedia_access_level: 1,
              agoda_access_level: 1,
              booking_access_level: 1
            }
          }
        ]
      })

      const properties = (rawResults as unknown as any[]).map((p: any) => ({
        id: p._id?.$oid ?? String(p._id),
        name: p.name as string,
        access_contact: (p.access_contact as string) ?? null,
        portfolio_contact_email: (p.portfolio_contact_email as string) ?? null,
        portfolio_contact: (p.portfolio_contact as string) ?? null,
        expedia_access_level: (p.expedia_access_level as boolean) ?? null,
        agoda_access_level: (p.agoda_access_level as boolean) ?? null,
        booking_access_level: (p.booking_access_level as boolean) ?? null
      }))

      this.logger.log(`Found ${properties.length} properties requiring OTA access notifications.`)
      console.log(properties)

      for (const property of properties) {
        if (!property.access_contact) {
          this.logger.warn(`Property "${property.name}" has false access level(s) but no access_contact. Skipping.`)
          continue
        }

        // Parse comma-separated emails
        const contactEmails = property.access_contact
          .split(',')
          .map(email => email.trim())
          .filter(email => email.length > 0)

        // Simple email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const validEmails = contactEmails.filter(email => emailRegex.test(email))

        if (validEmails.length === 0) {
          this.logger.warn(`Property "${property.name}" access_contact has no valid emails. Skipping.`)
          continue
        }

        const emailTextLines: string[] = []
        const emailHtmlBlocks: string[] = []

        const portfolioEmail = property.portfolio_contact_email || 'N/A'
        const portfolioPhone = property.portfolio_contact || 'N/A'

        if (property.expedia_access_level !== true) {
          emailTextLines.push(
            `Expedia (EPC)`,
            ` - Have the Property Admin grant Property User access.`,
            ` - Use email: ${portfolioEmail} (custom username allowed).`,
            ` - Phone (if required): ${portfolioPhone}`,
            ``
          )
          emailHtmlBlocks.push(`
            <h3 style="margin-top: 15px; margin-bottom: 5px; color: #333;">Expedia (EPC)</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Have the Property Admin grant Property User access.</li>
              <li>Use email: <strong>${portfolioEmail}</strong> (custom username allowed).</li>
              <li>Phone (if required): <strong>${portfolioPhone}</strong></li>
            </ul>
          `)
        }

        if (property.agoda_access_level !== true) {
          emailTextLines.push(
            `Agoda / Priceline (ycs.agoda.com)`,
            ` - You must be an Admin-Level User.`,
            ` - Send an Invite a New User request from your dashboard.`,
            ` - Email: ${portfolioEmail} · Phone: ${portfolioPhone}`,
            ` - Permissions: enable Finance and Reservations access.`,
            ` - Send the invite once complete.`,
            ``
          )
          emailHtmlBlocks.push(`
            <h3 style="margin-top: 15px; margin-bottom: 5px; color: #333;">Agoda / Priceline (ycs.agoda.com)</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>You must be an Admin-Level User.</li>
              <li>Send an Invite a New User request from your dashboard.</li>
              <li>Email: <strong>${portfolioEmail}</strong> &middot; Phone: <strong>${portfolioPhone}</strong></li>
              <li>Permissions: enable Finance and Reservations access.</li>
              <li>Send the invite once complete.</li>
            </ul>
          `)
        }

        if (property.booking_access_level !== true) {
          emailTextLines.push(
            `Booking.com (admin.booking.com)`,
            ` - You must be an Admin-Level User.`,
            ` - From dashboard, select Invite a New User.`,
            ` - Email: ${portfolioEmail}`,
            ` - Phone (if required): ${portfolioPhone}`,
            ` - Permissions: enable Finance and Reservations access.`,
            ` - Send the invite once complete.`,
            ``
          )
          emailHtmlBlocks.push(`
            <h3 style="margin-top: 15px; margin-bottom: 5px; color: #333;">Booking.com (admin.booking.com)</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>You must be an Admin-Level User.</li>
              <li>From dashboard, select Invite a New User.</li>
              <li>Email: <strong>${portfolioEmail}</strong></li>
              <li>Phone (if required): <strong>${portfolioPhone}</strong></li>
              <li>Permissions: enable Finance and Reservations access.</li>
              <li>Send the invite once complete.</li>
            </ul>
          `)
        }

        // Build plain text body
        const plainTextBody = `Dear Partner,\n\nPlease update the access settings for the following OTA channel(s) for the property "${property.name}":\n\n` +
          emailTextLines.join('\n') +
          `Warm regards,\nVNP Solutions Team`

        // Build HTML body
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <p>Dear Partner,</p>
            <p>Please update the access settings for the following OTA channel(s) for the property <strong>${property.name}</strong>:</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            ${emailHtmlBlocks.join('<br/>')}
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 14px;">Thank you for your cooperation.</p>
            <p style="color: #666; font-size: 14px;">Warm regards,<br/><strong>VNP Solutions Team</strong></p>
          </div>
        `

        // Send email
        const subject = `Action Required: Grant OTA Access for ${property.name}`
        try {
          await this.emailUtil.sendEmail(validEmails, subject, plainTextBody, undefined, htmlBody)
          this.logger.log(`✓ Sent OTA Access email to ${validEmails.join(', ')} for property "${property.name}"`)
        } catch (err) {
          this.logger.error(`✗ Failed to send OTA Access email to ${validEmails.join(', ')} for property "${property.name}":`, err)
        }
      }
    } catch (err) {
      this.logger.error('Error occurred in Friday OTA Access Check job:', err)
    }
  }
}
