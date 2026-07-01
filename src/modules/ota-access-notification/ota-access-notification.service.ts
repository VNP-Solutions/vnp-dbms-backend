import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { EmailUtil } from '../../common/utils/email.util'
import type { INotificationEmailService } from '../notification-email/notification-email.interface'

interface OtaAccessProperty {
  id: string
  name: string
  access_contact: string | null
  portfolio_contact_email: string | null
  portfolio_contact: string | null
  expedia_access_level: boolean | null
  agoda_access_level: boolean | null
  booking_access_level: boolean | null
}

interface OtaAccessEmailContent {
  subject: string
  plainTextBody: string
  htmlBody: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
      const setting = await this.notificationEmailService.getSetting()
      if (!setting.is_active) {
        this.logger.log('Notification emails are disabled. Skipping OTA access notifications.')
        return
      }

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
      })) as OtaAccessProperty[]

      this.logger.log(`Found ${properties.length} properties requiring OTA access notifications.`)

      const propertiesByEmail = this.groupPropertiesByAccessEmail(properties)
      this.logger.log(
        `Grouped into ${propertiesByEmail.size} recipient email(s) for OTA access notifications.`
      )

      for (const [recipientEmail, recipientProperties] of propertiesByEmail) {
        const propertyNames = recipientProperties.map(p => `"${p.name}"`).join(', ')
        const { subject, plainTextBody, htmlBody } = this.buildGroupedEmailContent(
          recipientProperties
        )

        try {
          await this.emailUtil.sendEmail(recipientEmail, subject, plainTextBody, undefined, htmlBody)
          this.logger.log(
            `✓ Sent OTA Access email to ${recipientEmail} for ${recipientProperties.length} propert${recipientProperties.length === 1 ? 'y' : 'ies'}: ${propertyNames}`
          )
        } catch (err) {
          this.logger.error(
            `✗ Failed to send OTA Access email to ${recipientEmail} for ${recipientProperties.length} propert${recipientProperties.length === 1 ? 'y' : 'ies'}: ${propertyNames}`,
            err
          )
        }
      }
    } catch (err) {
      this.logger.error('Error occurred in Friday OTA Access Check job:', err)
    }
  }

  private groupPropertiesByAccessEmail(
    properties: OtaAccessProperty[]
  ): Map<string, OtaAccessProperty[]> {
    const grouped = new Map<string, OtaAccessProperty[]>()

    for (const property of properties) {
      if (!property.access_contact) {
        this.logger.warn(
          `Property "${property.name}" has false access level(s) but no access_contact. Skipping.`
        )
        continue
      }

      const validEmails = this.parseValidAccessEmails(property.access_contact)
      if (validEmails.length === 0) {
        this.logger.warn(
          `Property "${property.name}" access_contact has no valid emails. Skipping.`
        )
        continue
      }

      for (const email of validEmails) {
        const key = email.toLowerCase()
        const existing = grouped.get(key) ?? []
        existing.push(property)
        grouped.set(key, existing)
      }
    }

    return grouped
  }

  private parseValidAccessEmails(accessContact: string): string[] {
    const seen = new Set<string>()
    const validEmails: string[] = []

    for (const email of accessContact.split(',').map(value => value.trim()).filter(Boolean)) {
      if (!EMAIL_REGEX.test(email)) {
        continue
      }

      const key = email.toLowerCase()
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      validEmails.push(email)
    }

    return validEmails
  }

  private buildPropertyOtaSections(property: OtaAccessProperty): {
    textLines: string[]
    htmlBlocks: string[]
  } {
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

    return { textLines: emailTextLines, htmlBlocks: emailHtmlBlocks }
  }

  private buildGroupedEmailContent(properties: OtaAccessProperty[]): OtaAccessEmailContent {
    const propertyTextSections: string[] = []
    const propertyHtmlSections: string[] = []

    for (const property of properties) {
      const { textLines, htmlBlocks } = this.buildPropertyOtaSections(property)

      propertyTextSections.push(
        `Property: ${property.name}`,
        ...textLines
      )
      propertyHtmlSections.push(`
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0 0 10px; color: #222; font-size: 18px;">${property.name}</h2>
          ${htmlBlocks.join('<br/>')}
        </div>
      `)
    }

    const intro =
      properties.length === 1
        ? `Please update the access settings for the following OTA channel(s) for the property "${properties[0].name}":`
        : `Please update the access settings for the following OTA channel(s) for the ${properties.length} properties listed below:`

    const plainTextBody =
      `Dear Partner,\n\n${intro}\n\n` +
      propertyTextSections.join('\n') +
      `Warm regards,\nVNP Solutions Team`

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
        <p>Dear Partner,</p>
        <p>${intro}</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        ${propertyHtmlSections.join('<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />')}
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #666; font-size: 14px;">Thank you for your cooperation.</p>
        <p style="color: #666; font-size: 14px;">Warm regards,<br/><strong>VNP Solutions Team</strong></p>
      </div>
    `

    const subject =
      properties.length === 1
        ? `Action Required: Grant OTA Access for ${properties[0].name}`
        : `Action Required: Grant OTA Access for ${properties.length} Properties`

    return { subject, plainTextBody, htmlBody }
  }
}
