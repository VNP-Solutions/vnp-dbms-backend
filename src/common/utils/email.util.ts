import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as http from 'http'
import * as https from 'https'
import * as nodemailer from 'nodemailer'
import { URL } from 'url'
import * as XLSX from 'xlsx'
import { Configuration } from '../../config/configuration'
import type {
    AttachmentUrlDto,
    EmailAttachment
} from '../../modules/email/email.dto'
import { PrismaService } from '../../modules/prisma/prisma.service'

/** Mirrors property.interface.ts's UploadJobEntity — kept as a local, loose
 *  shape here (rather than importing from the property module) so this
 *  generic email utility doesn't depend on a specific feature module. */
interface UploadJobEntitySummary {
  row: number | null
  name: string
  dbms: { state: string; reason?: string }
  scraper: { state: string; reason?: string }
  dashboard: { state: string; reason?: string }
}

@Injectable()
export class EmailUtil {
  private transporter: nodemailer.Transporter
  private static smtpVerified = false

  constructor(
    private configService: ConfigService<Configuration>,
    private prisma: PrismaService
  ) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      auth: {
        user: this.configService.get('smtp.email', { infer: true }),
        pass: this.configService.get('smtp.password', { infer: true })
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      logger: false,
      debug: false
    })

    // Verify transporter configuration on startup (only log once)
    if (!EmailUtil.smtpVerified) {
      EmailUtil.smtpVerified = true
      this.transporter.verify((error) => {
        if (error) {
          console.error('\x1b[31mSMTP connection failed: %s\x1b[0m', error instanceof Error ? error.message : String(error))
        } else {
          console.log('SMTP is ready to send emails')
        }
      })
    }
  }

  async sendOtpEmail(email: string, otp: number): Promise<void> {
    // Fetch user's first name from database
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { first_name: true }
    })

    const firstName = user?.first_name?.split(' ')[0] || ''
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'Your VNP Solutions One-Time Password (OTP)',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <p><strong>${greeting}</strong></p>
          <p>For your security, please use the following One-Time Password to complete your login or verification process with VNP Solutions:</p>
          <p><strong>OTP:</strong></p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #666;">This code is valid for 10 minutes. Do not share it with anyone. VNP Solutions will never ask for your password or OTP over phone or email.</p>
          <p style="color: #666;">If you did not request this, please disregard this message.</p>
          <div style="margin-top: 30px; color: #666;">
            <p>Warm regards,<br>VNP Solutions Support Team<br><a href="http://www.vnpsolutions.com" style="color: #007bff;">www.vnpsolutions.com</a></p>
          </div>
        </div>
      `,
      text: `${greeting}\n\nFor your security, please use the following One-Time Password to complete your login or verification process with VNP Solutions:\n\nOTP: ${otp}\n\nThis code is valid for 10 minutes. Do not share it with anyone. VNP Solutions will never ask for your password or OTP over phone or email.\n\nIf you did not request this, please disregard this message.\n\nWarm regards,\nVNP Solutions Support Team\nwww.vnpsolutions.com`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ OTP email sent:', { to: email, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send OTP email:', error)
      throw new BadRequestException(
        `Failed to send OTP email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendInvitationEmail(
    email: string,
    tempPassword: string,
    roleName: string,
    firstName: string,
    isExternal: boolean
  ): Promise<void> {
    const redirectUrl = this.configService.get('invitationRedirectUrl', {
      infer: true
    })

    const firstNameOnly = firstName.split(' ')[0]
    const greeting = firstNameOnly ? `Hi ${firstNameOnly},` : 'Hi,'

    // Internal member template
    if (!isExternal) {
      const mailOptions = {
        from: this.configService.get('smtp.email', { infer: true }),
        to: email,
        subject: "You've been added to the VNP Solutions team",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
            <p><strong>${greeting}</strong></p>
            <p>Welcome aboard! You've been invited to join the <strong>VNP Solutions</strong> platform as part of our internal team.</p>
            <p>Your temporary password is:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
              ${tempPassword}
            </div>
            <p style="color: #666;">⏳ This temporary password is valid for <strong>5 days</strong>.</p>
            <p>Click the link below to set up your account and get started:</p>
            ${redirectUrl ? `<p><a href="${redirectUrl}?email=${email}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Accept Invitation →</a></p>` : ''}
            <p style="color: #666;">If you weren't expecting this invitation, please contact your manager or reply to this email.</p>
            <div style="margin-top: 30px;">
              <p>Best regards,<br><strong>VNP Solutions Admin</strong></p>
            </div>
          </div>
        `,
        text: `${greeting}\n\nWelcome aboard! You've been invited to join the VNP Solutions platform as part of our internal team.\n\nYour temporary password is: ${tempPassword}\n\nThis temporary password is valid for 5 days.\n\nClick the link below to set up your account and get started:\n${redirectUrl ? `${redirectUrl}?email=${email}` : ''}\n\nIf you weren't expecting this invitation, please contact your manager or reply to this email.\n\nBest regards,\nVNP Solutions Admin`
      }

      try {
        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Internal invitation email sent:', {
          to: email,
          messageId: info.messageId
        })
      } catch (error) {
        console.error('✗ Failed to send internal invitation email:', error)
        throw new BadRequestException(
          `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
      return
    }

    // External member template
    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'Access Invitation – VNP Solutions Audit Dashboard',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <p><strong>${greeting}</strong></p>
          <p>We're excited to have you onboard with <strong>VNP Solutions</strong>, your trusted partner for OTA Revenue Recovery and Audit Services.</p>
          <p>You've been invited to access your property's dashboard to review audit results, payment summaries, and compliance reports.</p>
          <p>Your temporary password is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 20px 0;">
            ${tempPassword}
          </div>
          <p style="color: #666;">⏳ This temporary password is valid for <strong>5 days</strong>.</p>
          <p>Click below to activate your account:</p>
          ${redirectUrl ? `<p><a href="${redirectUrl}?email=${email}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Activate Account →</a></p>` : ''}
          <p style="color: #666;">If you need any help during setup, please contact us at support@vnpsolutions.com.</p>
          <div style="margin-top: 30px;">
            <p>Warm regards,<br><strong>Client Success Team</strong><br><strong>VNP Solutions</strong></p>
          </div>
        </div>
      `,
      text: `${greeting}\n\nWe're excited to have you onboard with VNP Solutions, your trusted partner for OTA Revenue Recovery and Audit Services.\n\nYou've been invited to access your property's dashboard to review audit results, payment summaries, and compliance reports.\n\nYour temporary password is: ${tempPassword}\n\nThis temporary password is valid for 5 days.\n\nClick below to activate your account:\n${redirectUrl ? `${redirectUrl}?email=${email}` : ''}\n\nIf you need any help during setup, please contact us at support@vnpsolutions.com.\n\nWarm regards,\nClient Success Team\nVNP Solutions`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ External invitation email sent:', {
        to: email,
        messageId: info.messageId
      })
    } catch (error) {
      console.error('✗ Failed to send external invitation email:', error)
      throw new BadRequestException(
        `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendTokenInvitationEmail(
    email: string,
    invitationToken: string,
    invitedByName: string,
    message?: string
  ): Promise<void> {
    const redirectUrl = this.configService.get('invitationRedirectUrl', {
      infer: true
    })

    const invitationUrl = redirectUrl
      ? `${redirectUrl}?token=${encodeURIComponent(invitationToken)}`
      : undefined

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: `You're invited to join VNP Solutions`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <p><strong>Hello,</strong></p>
          <p>${invitedByName} has invited you to access the VNP Solutions dashboard.</p>
          ${
            message
              ? `<p style="margin: 16px 0; padding: 12px; background-color: #f8f9fa; border-left: 4px solid #007bff; font-style: italic;">${message}</p>`
              : ''
          }
          <p>Click the button below to accept the invitation and set up your account:</p>
          ${
            invitationUrl
              ? `<p><a href="${invitationUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold;">Accept Invitation →</a></p>`
              : ''
          }
          ${
            invitationUrl
              ? `<p style="font-size: 12px; color: #666;">If the button above does not work, copy and paste this link into your browser:<br><span>${invitationUrl}</span></p>`
              : ''
          }
          <p style="color: #666;">If you were not expecting this invitation, you can safely ignore this email.</p>
          <div style="margin-top: 30px;">
            <p>Best regards,<br><strong>VNP Solutions Team</strong></p>
          </div>
        </div>
      `,
      text: `Hello,

${invitedByName} has invited you to access the VNP Solutions dashboard.

${message ? `Message from inviter:\n${message}\n\n` : ''}${
        invitationUrl
          ? `Accept your invitation by opening this link in your browser:\n${invitationUrl}\n\n`
          : ''
      }If you were not expecting this invitation, you can safely ignore this email.

Best regards,
VNP Solutions Team`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Token-based invitation email sent:', {
        to: email,
        messageId: info.messageId
      })
    } catch (error) {
      console.error('✗ Failed to send token-based invitation email:', error)
      throw new BadRequestException(
        `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendPasswordResetOtpEmail(email: string, otp: number): Promise<void> {
    // Fetch user's first name from database
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { first_name: true }
    })

    const firstName = user?.first_name?.split(' ')[0] || ''
    const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: email,
      subject: 'Reset your VNP Solutions password',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <p><strong>${greeting}</strong></p>
          <p>We received a request to reset your VNP Solutions password. If this was you, use the OTP below to create a new one:</p>
          <p><strong>Your OTP:</strong></p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in <strong>10 minutes</strong> for your security.</p>
          <p style="color: #666;">If you didn't request a password reset, no action is required.</p>
          <div style="margin-top: 30px;">
            <p>Stay secure,<br><strong>VNP Solutions Support Team</strong></p>
          </div>
        </div>
      `,
      text: `${greeting}\n\nWe received a request to reset your VNP Solutions password. If this was you, use the OTP below to create a new one:\n\nYour OTP: ${otp}\n\nThis code will expire in 10 minutes for your security.\n\nIf you didn't request a password reset, no action is required.\n\nStay secure,\nVNP Solutions Support Team`
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Password reset OTP email sent:', { to: email, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send password reset OTP email:', error)
      throw new BadRequestException(
        `Failed to send password reset OTP email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    body: string,
    attachments?: EmailAttachment[],
    html?: string
  ): Promise<void> {
    // Handle array of emails - remove duplicates and filter empty values
    const recipients = Array.isArray(to)
      ? [...new Set(to.filter(email => email && email.trim()))]
      : [to]

    if (recipients.length === 0) {
      console.warn('No valid recipient emails provided')
      return
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: recipients,
      subject,
      text: body,
      ...(html && { html })
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      // Calculate total attachment size
      const totalSize = attachments.reduce(
        (sum, att) => sum + att.content.length,
        0
      )
      const totalSizeMB = totalSize / (1024 * 1024)

      console.log(
        `Sending email with ${attachments.length} attachment(s), total size: ${totalSizeMB.toFixed(2)}MB`
      )

      // Warn if approaching Gmail's 25MB limit
      if (totalSizeMB > 20) {
        console.warn(
          `⚠️ Attachment size (${totalSizeMB.toFixed(2)}MB) is approaching Gmail's 25MB limit`
        )
      }

      if (totalSizeMB > 25) {
        throw new BadRequestException(
          `Total attachment size (${totalSizeMB.toFixed(2)}MB) exceeds Gmail's 25MB limit`
        )
      }

      mailOptions.attachments = attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Email sent successfully!', {
        messageId: info.messageId,
        to: recipients,
        recipientCount: recipients.length,
        subject,
        response: info.response,
        attachmentCount: attachments?.length || 0
      })
    } catch (error) {
      console.error('✗ Failed to send email:', {
        to: recipients,
        subject,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      })
      throw new BadRequestException(
        `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Fetch a file from a URL and return it as a buffer
   */
  async fetchFileFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url)
        const protocol = parsedUrl.protocol === 'https:' ? https : http

        // Set timeout for the request (30 seconds)
        const timeout = setTimeout(() => {
          reject(
            new BadRequestException(
              `Timeout while fetching file from URL: ${url}`
            )
          )
        }, 30000)

        const request = protocol
          .get(url, response => {
            if (
              response.statusCode &&
              (response.statusCode < 200 || response.statusCode >= 300)
            ) {
              clearTimeout(timeout)
              reject(
                new BadRequestException(
                  `Failed to fetch file from URL: ${url}. Status: ${response.statusCode}`
                )
              )
              return
            }

            const chunks: Buffer[] = []
            let totalSize = 0

            response.on('data', (chunk: Buffer) => {
              chunks.push(chunk)
              totalSize += chunk.length

              // Prevent downloading files larger than 25MB
              if (totalSize > 25 * 1024 * 1024) {
                clearTimeout(timeout)
                request.destroy()
                reject(
                  new BadRequestException(
                    `File from URL is too large (>25MB): ${url}`
                  )
                )
              }
            })

            response.on('end', () => {
              clearTimeout(timeout)
              console.log(`✓ Fetched file from URL: ${url} (${(totalSize / 1024 / 1024).toFixed(2)}MB)`)
              resolve(Buffer.concat(chunks))
            })

            response.on('error', err => {
              clearTimeout(timeout)
              reject(
                new BadRequestException(
                  `Error downloading file from URL: ${err.message}`
                )
              )
            })
          })
          .on('error', err => {
            clearTimeout(timeout)
            reject(
              new BadRequestException(
                `Error fetching file from URL: ${err.message}`
              )
            )
          })
      } catch (error) {
        reject(
          new BadRequestException(
            `Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        )
      }
    })
  }

  /**
   * Extract filename from URL or use provided filename
   */
  getFilenameFromUrl(url: string, customFilename?: string): string {
    if (customFilename) {
      return customFilename
    }

    try {
      const parsedUrl = new URL(url)
      const pathname = parsedUrl.pathname
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
      return filename || 'attachment'
    } catch {
      return 'attachment'
    }
  }

  /**
   * Fetch attachments from URLs and convert to EmailAttachment format
   */
  async fetchAttachmentsFromUrls(
    attachmentUrls: AttachmentUrlDto[]
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = []

    for (const attachmentUrl of attachmentUrls) {
      try {
        const buffer = await this.fetchFileFromUrl(attachmentUrl.url)
        const filename = this.getFilenameFromUrl(
          attachmentUrl.url,
          attachmentUrl.filename
        )

        // Determine content type based on file extension
        const contentType = this.getContentTypeFromFilename(filename)

        attachments.push({
          filename,
          content: buffer,
          contentType
        })
      } catch (error) {
        throw new BadRequestException(
          `Failed to fetch attachment from URL ${attachmentUrl.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    return attachments
  }

  /**
   * Get MIME type based on file extension
   */
  private getContentTypeFromFilename(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop()
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
      zip: 'application/zip',
      json: 'application/json'
    }

    return mimeTypes[extension || ''] || 'application/octet-stream'
  }

  async sendPropertyTransferEmail(
    recipientEmails: string[],
    propertyName: string,
    newPortfolioName: string,
    effectiveDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for property transfer notification')
      return
    }

    // Format the effective date
    const formattedDate = effectiveDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: `Property Transfer Notification – ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>We wanted to inform you that <strong>${propertyName}</strong> has been transferred under the management of <strong>${newPortfolioName}</strong> effective <strong>${formattedDate}</strong>.</p>
              <p>All audit and reporting access have been updated in the <strong>VNP Solutions Dashboard</strong> accordingly.</p>
              <p>If you believe this transfer was made in error or need additional details, please contact <strong>support@vnpsolutions.com</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Support Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nWe wanted to inform you that ${propertyName} has been transferred under the management of ${newPortfolioName} effective ${formattedDate}.\n\nAll audit and reporting access have been updated in the VNP Solutions Dashboard accordingly.\n\nIf you believe this transfer was made in error or need additional details, please contact support@vnpsolutions.com.\n\nWarm regards,\nVNP Solutions Support Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Property transfer email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send property transfer email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendAuditStatusChangeEmail(
    recipientEmails: string[],
    auditName: string,
    oldStatus: string,
    newStatus: string,
    effectiveDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for audit status change notification')
      return
    }

    // Format the effective date
    const formattedDate = effectiveDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Get dashboard URL from config
    const dashboardUrl = String(this.configService.get('dashboardUrl', { infer: true }) || 'https://new.dashboardvnps.com/')

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Dear user,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: 'Update on Your Audit Status – VNP Solutions',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>A status update has been recorded for your <strong>${auditName}</strong> audit.</p>
              <p>📊 <strong>Previous Status:</strong> ${oldStatus}</p>
              <p>🔄 <strong>New Status:</strong> ${newStatus}</p>
              <p>🕒 <strong>Effective Date:</strong> ${formattedDate}</p>
              <p>You can log in to your dashboard at any time to view the details of this change and associated reports.</p>
              <div style="margin: 30px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Dashboard →</a>
              </div>
              <p>Thank you for your continued partnership with <strong>VNP Solutions</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nA status update has been recorded for your ${auditName} audit.\n\n📊 Previous Status: ${oldStatus}\n🔄 New Status: ${newStatus}\n🕒 Effective Date: ${formattedDate}\n\nYou can log in to your dashboard at any time to view the details of this change and associated reports.\n\nAccess Dashboard: ${dashboardUrl}\n\nThank you for your continued partnership with VNP Solutions.\n\nWarm regards,\nVNP Solutions Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Audit status change email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send audit status change email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendPropertyTransferRejectionEmail(
    recipientEmails: string[],
    propertyName: string,
    currentPortfolioName: string,
    targetPortfolioName: string,
    rejectionReason: string,
    requestedDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for property transfer rejection notification')
      return
    }

    // Format the requested date
    const formattedDate = requestedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: `Property Transfer Request Rejected – ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>We wanted to inform you that the request to transfer <strong>${propertyName}</strong> from <strong>${currentPortfolioName}</strong> to <strong>${targetPortfolioName}</strong> has been <strong style="color: #dc3545;">rejected</strong>.</p>
              <p><strong>📅 Requested Date:</strong> ${formattedDate}</p>
              <p><strong>❌ Rejection Reason:</strong></p>
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24;">${rejectionReason}</p>
              </div>
              <p>The property remains under the management of <strong>${currentPortfolioName}</strong> in the <strong>VNP Solutions Dashboard</strong>.</p>
              <p>If you have any questions or need further clarification, please contact <strong>support@vnpsolutions.com</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Support Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nWe wanted to inform you that the request to transfer ${propertyName} from ${currentPortfolioName} to ${targetPortfolioName} has been rejected.\n\n📅 Requested Date: ${formattedDate}\n\n❌ Rejection Reason:\n${rejectionReason}\n\nThe property remains under the management of ${currentPortfolioName} in the VNP Solutions Dashboard.\n\nIf you have any questions or need further clarification, please contact support@vnpsolutions.com.\n\nWarm regards,\nVNP Solutions Support Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Property transfer rejection email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send property transfer rejection email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendPropertyDeactivateRejectionEmail(
    recipientEmails: string[],
    propertyName: string,
    portfolioName: string,
    rejectionReason: string,
    requestedDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for property deactivation rejection notification')
      return
    }

    // Format the requested date
    const formattedDate = requestedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: `Property Deactivation Request Rejected – ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>We wanted to inform you that the request to deactivate <strong>${propertyName}</strong> under <strong>${portfolioName}</strong> has been <strong style="color: #dc3545;">rejected</strong>.</p>
              <p><strong>📅 Requested Date:</strong> ${formattedDate}</p>
              <p><strong>❌ Rejection Reason:</strong></p>
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24;">${rejectionReason}</p>
              </div>
              <p>The property remains active in the <strong>VNP Solutions Dashboard</strong>.</p>
              <p>If you have any questions or need further clarification, please contact <strong>support@vnpsolutions.com</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Support Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nWe wanted to inform you that the request to deactivate ${propertyName} under ${portfolioName} has been rejected.\n\n📅 Requested Date: ${formattedDate}\n\n❌ Rejection Reason:\n${rejectionReason}\n\nThe property remains active in the VNP Solutions Dashboard.\n\nIf you have any questions or need further clarification, please contact support@vnpsolutions.com.\n\nWarm regards,\nVNP Solutions Support Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Property deactivation rejection email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send property deactivation rejection email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendPortfolioDeactivateRejectionEmail(
    recipientEmails: string[],
    portfolioName: string,
    rejectionReason: string,
    requestedDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for portfolio deactivation rejection notification')
      return
    }

    // Format the requested date
    const formattedDate = requestedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: `Portfolio Deactivation Request Rejected – ${portfolioName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>We wanted to inform you that the request to deactivate the portfolio <strong>${portfolioName}</strong> has been <strong style="color: #dc3545;">rejected</strong>.</p>
              <p><strong>📅 Requested Date:</strong> ${formattedDate}</p>
              <p><strong>❌ Rejection Reason:</strong></p>
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24;">${rejectionReason}</p>
              </div>
              <p>The portfolio remains active in the <strong>VNP Solutions Dashboard</strong>.</p>
              <p>If you have any questions or need further clarification, please contact <strong>support@vnpsolutions.com</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Support Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nWe wanted to inform you that the request to deactivate the portfolio ${portfolioName} has been rejected.\n\n📅 Requested Date: ${formattedDate}\n\n❌ Rejection Reason:\n${rejectionReason}\n\nThe portfolio remains active in the VNP Solutions Dashboard.\n\nIf you have any questions or need further clarification, please contact support@vnpsolutions.com.\n\nWarm regards,\nVNP Solutions Support Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Portfolio deactivation rejection email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send portfolio deactivation rejection email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendPropertySyncResultEmail(
    recipientEmail: string,
    property: {
      name: string
      identifier: string
    },
    results: {
      dbms: boolean
      dashboard: { success: boolean; reason?: string }
      parser: { success: boolean; reason?: string }
    },
    operation: 'create' | 'update'
  ): Promise<void> {
    const fmt = (ok: boolean) => ok ? 'YES' : 'NO'
    const cleanReason = (raw: string | undefined): string => {
      if (!raw) return ''
      try {
        const parsed = JSON.parse(raw)
        const msgs: string[] = Array.isArray(parsed?.message)
          ? parsed.message
          : typeof parsed?.message === 'string' ? [parsed.message] : []
        if (msgs.length) return msgs.join(', ')
        if (typeof parsed?.error === 'string') return parsed.error
      } catch { /* not JSON */ }
      return raw
    }
    const reasons: string[] = []
    if (!results.dashboard.success && results.dashboard.reason) reasons.push(`Dashboard: ${cleanReason(results.dashboard.reason)}`)
    if (!results.parser.success && results.parser.reason) reasons.push(`Parser: ${cleanReason(results.parser.reason)}`)
    const reasonStr = reasons.length ? reasons.join(' | ') : 'N/A'

    const summaryLine = `${property.name} | ${property.identifier} | DBMS - ${fmt(results.dbms)} | DASHBOARD - ${fmt(results.dashboard.success)} | PARSER - ${fmt(results.parser.success)} | REASON: ${reasonStr}`

    const overallOk = results.dbms && results.dashboard.success && results.parser.success
    const statusLabel = overallOk ? 'Successful' : 'Partially Failed'
    const opLabel = operation === 'create' ? 'Created' : 'Updated'

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: recipientEmail,
      subject: `Property Sync ${statusLabel} – ${property.name} (${opLabel})`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 640px; margin: 0 auto;">
          <h3 style="margin-bottom: 4px;">Property Sync Report</h3>
          <p style="color: #555; margin-top: 0;">Operation: <strong>${opLabel}</strong></p>
          <table style="width:100%; border-collapse:collapse; font-size:14px; margin-top:16px;">
            <tr style="background:#f4f4f4;">
              <th style="text-align:left; padding:8px 12px; border:1px solid #ddd;">Property</th>
              <th style="text-align:left; padding:8px 12px; border:1px solid #ddd;">Identifier</th>
              <th style="text-align:center; padding:8px 12px; border:1px solid #ddd;">DBMS</th>
              <th style="text-align:center; padding:8px 12px; border:1px solid #ddd;">Dashboard</th>
              <th style="text-align:center; padding:8px 12px; border:1px solid #ddd;">Parser</th>
            </tr>
            <tr>
              <td style="padding:8px 12px; border:1px solid #ddd;">${property.name}</td>
              <td style="padding:8px 12px; border:1px solid #ddd;">${property.identifier}</td>
              <td style="padding:8px 12px; border:1px solid #ddd; text-align:center; color:${results.dbms ? '#28a745' : '#dc3545'}"><strong>${fmt(results.dbms)}</strong></td>
              <td style="padding:8px 12px; border:1px solid #ddd; text-align:center; color:${results.dashboard.success ? '#28a745' : '#dc3545'}"><strong>${fmt(results.dashboard.success)}</strong></td>
              <td style="padding:8px 12px; border:1px solid #ddd; text-align:center; color:${results.parser.success ? '#28a745' : '#dc3545'}"><strong>${fmt(results.parser.success)}</strong></td>
            </tr>
          </table>
          ${reasons.length ? `
          <div style="margin-top:16px; background:#fff3cd; border-left:4px solid #ffc107; padding:12px 16px; border-radius:4px;">
            <strong>Reason(s):</strong> ${reasonStr}
          </div>` : ''}
          <p style="margin-top:20px; font-size:12px; color:#888;">VNP Solutions DBMS</p>
        </div>
      `,
      text: summaryLine
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Property sync result email sent:', { to: recipientEmail, messageId: info.messageId })
    } catch (error) {
      console.error('✗ Failed to send property sync result email:', error)
    }
  }

  /**
   * Sent once a background bulk-upload job (import or bulk-update) finishes
   * — successfully or not — since the old `SyncBatch` callback report email
   * this replaces was the only place users learned the outcome without
   * actively watching the UI. The frontend also polls
   * GET /property/upload-job/current for live progress, so this email is
   * just a "you can stop watching, here's the final tally" summary.
   */
  async sendUploadJobReportEmail(
    recipientEmail: string,
    job: {
      source: 'import' | 'bulk-update'
      filename: string
      error?: string
      portfolios: { total: number; items: UploadJobEntitySummary[] }
      properties: { total: number; items: UploadJobEntitySummary[] }
    }
  ): Promise<void> {
    // Parse NestJS/axios error strings into readable text.
    // Handles both plain strings and JSON like {"message":["field must not be empty"],...}
    const cleanReason = (raw: string | undefined): string => {
      if (!raw) return ''
      try {
        const parsed = JSON.parse(raw)
        const msgs: string[] = Array.isArray(parsed?.message)
          ? parsed.message
          : typeof parsed?.message === 'string'
            ? [parsed.message]
            : []
        if (msgs.length) return msgs.join(', ')
        if (typeof parsed?.error === 'string') return parsed.error
      } catch { /* not JSON, use as-is */ }
      return raw
    }

    const colorFor = (state: string): string => {
      if (state === 'created') return '#28a745'
      if (state === 'skipped') return '#f0ad4e'
      if (state === 'failed') return '#dc3545'
      return '#888' // pending/processing — shouldn't normally appear once the job is finished
    }

    const countIssues = (items: UploadJobEntitySummary[]): number =>
      items.filter(
        i =>
          i.dbms.state === 'failed' ||
          i.scraper.state === 'failed' ||
          i.dashboard.state === 'failed'
      ).length

    const rowsFor = (items: UploadJobEntitySummary[]): string =>
      items
        .map(item => {
          const reasons: string[] = []
          if (item.dbms.reason) reasons.push(`DBMS: ${cleanReason(item.dbms.reason)}`)
          if (item.scraper.reason)
            reasons.push(`Scraper: ${cleanReason(item.scraper.reason)}`)
          if (item.dashboard.reason)
            reasons.push(`Dashboard: ${cleanReason(item.dashboard.reason)}`)
          return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #ddd;">${item.row ?? '-'}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${item.name}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${colorFor(item.dbms.state)}"><strong>${item.dbms.state}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${colorFor(item.scraper.state)}"><strong>${item.scraper.state}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${colorFor(item.dashboard.state)}"><strong>${item.dashboard.state}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:${reasons.length ? '#c0392b' : '#666'};">${reasons.length ? reasons.join('; ') : '-'}</td>
        </tr>`
        })
        .join('')

    const sectionTable = (title: string, items: UploadJobEntitySummary[]): string => {
      if (!items.length) return ''
      return `
        <h4 style="margin:20px 0 6px;">${title} (${items.length})</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f4f4f4;">
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Row</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Name</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">DBMS</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">Scraper</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">Dashboard</th>
            <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Reason</th>
          </tr>
          ${rowsFor(items)}
        </table>`
    }

    const portfolioIssues = countIssues(job.portfolios.items)
    const propertyIssues = countIssues(job.properties.items)
    const totalIssues = portfolioIssues + propertyIssues
    const actionLabel = job.source === 'import' ? 'Import' : 'Bulk Update'

    // Builds a fresh workbook containing only the rows that failed
    // somewhere (DBMS, scraper, or dashboard) — same idea as the old
    // sync-batch report: a small, focused sheet the user can act on,
    // rather than re-sending their whole original file back to them.
    const isFailed = (item: UploadJobEntitySummary): boolean =>
      item.dbms.state === 'failed' ||
      item.scraper.state === 'failed' ||
      item.dashboard.state === 'failed'

    const toDefectiveRow = (type: string, item: UploadJobEntitySummary) => {
      const reasons: string[] = []
      if (item.dbms.reason) reasons.push(`DBMS: ${cleanReason(item.dbms.reason)}`)
      if (item.scraper.reason)
        reasons.push(`Scraper: ${cleanReason(item.scraper.reason)}`)
      if (item.dashboard.reason)
        reasons.push(`Dashboard: ${cleanReason(item.dashboard.reason)}`)
      return {
        Type: type,
        Row: item.row ?? '',
        Name: item.name,
        DBMS: item.dbms.state,
        Scraper: item.scraper.state,
        Dashboard: item.dashboard.state,
        Reason: reasons.join('; ') || 'N/A'
      }
    }

    const attachments: EmailAttachment[] = []
    if (totalIssues > 0) {
      const defectiveRows = [
        ...job.portfolios.items.filter(isFailed).map(i => toDefectiveRow('Portfolio', i)),
        ...job.properties.items.filter(isFailed).map(i => toDefectiveRow('Property', i))
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(defectiveRows),
        'Sync Issues'
      )
      const excelBuffer = Buffer.from(
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      )
      const filenameBase = job.filename.replace(/\.[^./]+$/, '') || 'upload'
      attachments.push({
        filename: `${filenameBase}-issues.xlsx`,
        content: excelBuffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    }

    const mailOptions: any = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: recipientEmail,
      subject: `${actionLabel} Report — ${job.filename} — ${job.portfolios.total} portfolios, ${job.properties.total} properties (${totalIssues} issue${totalIssues === 1 ? '' : 's'})`,
      text: `${actionLabel} finished for "${job.filename}".\n\nPortfolios: ${job.portfolios.total} (${portfolioIssues} issues)\nProperties: ${job.properties.total} (${propertyIssues} issues)${job.error ? `\n\nJob error: ${job.error}` : ''}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:1000px;margin:0 auto;">
          <h3 style="margin-bottom:4px;">${actionLabel} Report</h3>
          <p style="margin-top:0;color:#555;">File: <strong>${job.filename}</strong></p>
          <p style="color:#555;">
            Portfolios: <strong>${job.portfolios.total}</strong>
            (<span style="color:${portfolioIssues ? '#dc3545' : '#28a745'}">${portfolioIssues} issue${portfolioIssues === 1 ? '' : 's'}</span>)
            &nbsp;|&nbsp;
            Properties: <strong>${job.properties.total}</strong>
            (<span style="color:${propertyIssues ? '#dc3545' : '#28a745'}">${propertyIssues} issue${propertyIssues === 1 ? '' : 's'}</span>)
          </p>
          ${job.error ? `<p style="color:#dc3545;"><strong>Job error:</strong> ${job.error}</p>` : ''}
          ${sectionTable('Portfolios', job.portfolios.items)}
          ${sectionTable('Properties', job.properties.items)}
          ${attachments.length ? '<p style="margin-top:16px;color:#888;font-size:12px;">An Excel file listing only the rows that failed is attached for correction.</p>' : ''}
          <p style="margin-top:20px;font-size:12px;color:#888;">VNP Solutions DBMS</p>
        </div>
      `,
      ...(attachments.length && { attachments })
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Upload job report email sent:', {
        to: recipientEmail,
        messageId: info.messageId
      })
    } catch (error) {
      console.error('✗ Failed to send upload job report email:', error)
    }
  }

  async sendPropertyActivateRejectionEmail(
    recipientEmails: string[],
    propertyName: string,
    portfolioName: string,
    rejectionReason: string,
    requestedDate: Date
  ): Promise<void> {
    // Remove duplicates and filter out empty emails
    const uniqueEmails = [...new Set(recipientEmails.filter(email => email && email.trim()))]

    if (uniqueEmails.length === 0) {
      console.warn('No valid recipient emails provided for property activation rejection notification')
      return
    }

    // Format the requested date
    const formattedDate = requestedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send individual emails to each recipient for personalization
    for (const userEmail of uniqueEmails) {
      try {
        // Fetch user's first name from database
        const user = await this.prisma.user.findUnique({
          where: { email: userEmail },
          select: { first_name: true }
        })

        const firstName = user?.first_name?.split(' ')[0] || ''
        const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

        const mailOptions = {
          from: this.configService.get('smtp.email', { infer: true }),
          to: userEmail,
          subject: `Property Activation Request Rejected – ${propertyName}`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
              <p><strong>${greeting}</strong></p>
              <p>We wanted to inform you that the request to activate <strong>${propertyName}</strong> under <strong>${portfolioName}</strong> has been <strong style="color: #dc3545;">rejected</strong>.</p>
              <p><strong>📅 Requested Date:</strong> ${formattedDate}</p>
              <p><strong>❌ Rejection Reason:</strong></p>
              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #721c24;">${rejectionReason}</p>
              </div>
              <p>The property remains inactive in the <strong>VNP Solutions Dashboard</strong>.</p>
              <p>If you have any questions or need further clarification, please contact <strong>support@vnpsolutions.com</strong>.</p>
              <div style="margin-top: 30px; color: #666;">
                <p>Warm regards,<br><strong>VNP Solutions Support Team</strong></p>
              </div>
            </div>
          `,
          text: `${greeting}\n\nWe wanted to inform you that the request to activate ${propertyName} under ${portfolioName} has been rejected.\n\n📅 Requested Date: ${formattedDate}\n\n❌ Rejection Reason:\n${rejectionReason}\n\nThe property remains inactive in the VNP Solutions Dashboard.\n\nIf you have any questions or need further clarification, please contact support@vnpsolutions.com.\n\nWarm regards,\nVNP Solutions Support Team`
        }

        const info = await this.transporter.sendMail(mailOptions)
        console.log('✓ Property activation rejection email sent:', {
          to: userEmail,
          messageId: info.messageId
        })
      } catch (error) {
        console.error(`✗ Failed to send property activation rejection email to ${userEmail}:`, error)
        // Continue sending to other recipients even if one fails
      }
    }
  }

  async sendParserJobAssignmentErrorEmail(
    recipientEmail: string,
    details: {
      ota_type: string
      property_count: number
      message?: string
      rows?: Array<{
        name: string
        property_id: string
        dbms_ok: boolean
        parser_ok: boolean
        reason: string
      }>
    }
  ): Promise<void> {
    const fmt = (ok: boolean) => (ok ? 'YES' : 'NO')
    const rows = details.rows ?? []
    const successCount = rows.filter(row => row.dbms_ok && row.parser_ok).length
    const issueCount = rows.length - successCount
    const headline =
      details.message ??
      (issueCount > 0
        ? 'Some properties could not be assigned parser jobs'
        : 'Parser job assignment failed')

    const tableRows = rows
      .map(row => {
        const allOk = row.dbms_ok && row.parser_ok
        return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #ddd;">${row.name}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${row.property_id}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${row.dbms_ok ? '#28a745' : '#dc3545'}"><strong>${fmt(row.dbms_ok)}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${row.parser_ok ? '#28a745' : '#dc3545'}"><strong>${fmt(row.parser_ok)}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:${allOk ? '#666' : '#c0392b'};">${row.reason}</td>
        </tr>`
      })
      .join('')

    const textLines = rows
      .map(
        row =>
          `${row.name} | ${row.property_id} | DBMS - ${fmt(row.dbms_ok)} | PARSER - ${fmt(row.parser_ok)} | REASON: ${row.reason}`
      )
      .join('\n')

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: recipientEmail,
      subject: `Parser Job Assignment Report – ${details.ota_type.toUpperCase()} (${issueCount || details.property_count} issues)`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto;">
          <h3 style="margin-bottom:4px;">Parser Job Assignment Report</h3>
          <p style="margin-top:0;color:#555;">
            OTA: <strong>${details.ota_type}</strong> &nbsp;|&nbsp;
            Requested: <strong>${details.property_count}</strong> &nbsp;|&nbsp;
            Successful: <strong style="color:#28a745">${successCount}</strong> &nbsp;|&nbsp;
            Issues: <strong style="color:${issueCount ? '#dc3545' : '#28a745'}">${issueCount || details.property_count}</strong>
          </p>
          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <strong>${headline}</strong>
          </div>
          ${
            rows.length
              ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
            <tr style="background:#f4f4f4;">
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Property</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Property ID</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">DBMS</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">Parser</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Reason</th>
            </tr>
            ${tableRows}
          </table>`
              : ''
          }
          <p style="margin-top:20px;font-size:12px;color:#888;">VNP Solutions DBMS</p>
        </div>
      `,
      text: [
        `Parser Job Assignment Report for OTA ${details.ota_type}.`,
        `Requested: ${details.property_count} | Successful: ${successCount} | Issues: ${issueCount || details.property_count}`,
        headline,
        textLines
      ]
        .filter(Boolean)
        .join('\n\n')
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Parser job assignment error email sent:', {
        to: recipientEmail,
        messageId: info.messageId
      })
    } catch (error) {
      console.error('✗ Failed to send parser job assignment error email:', error)
    }
  }

  async sendRetrievalJobAssignmentErrorEmail(
    recipientEmail: string,
    details: {
      file_name: string
      hotel_count: number
      message?: string
      rows?: Array<{
        name: string
        hotel_id: string
        dbms_ok: boolean
        scraper_ok: boolean
        reason: string
      }>
    }
  ): Promise<void> {
    const fmt = (ok: boolean) => (ok ? 'YES' : 'NO')
    const rows = details.rows ?? []
    const successCount = rows.filter(row => row.dbms_ok && row.scraper_ok).length
    const issueCount = rows.length - successCount
    const headline =
      details.message ??
      (issueCount > 0
        ? 'Some hotels could not be assigned retrieval jobs'
        : 'Retrieval job upload failed')

    const tableRows = rows
      .map(row => {
        const allOk = row.dbms_ok && row.scraper_ok
        return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #ddd;">${row.name}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${row.hotel_id}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${row.dbms_ok ? '#28a745' : '#dc3545'}"><strong>${fmt(row.dbms_ok)}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;text-align:center;color:${row.scraper_ok ? '#28a745' : '#dc3545'}"><strong>${fmt(row.scraper_ok)}</strong></td>
          <td style="padding:6px 10px;border:1px solid #ddd;font-size:12px;color:${allOk ? '#666' : '#c0392b'};">${row.reason}</td>
        </tr>`
      })
      .join('')

    const textLines = rows
      .map(
        row =>
          `${row.name} | ${row.hotel_id} | DBMS - ${fmt(row.dbms_ok)} | SCRAPER - ${fmt(row.scraper_ok)} | REASON: ${row.reason}`
      )
      .join('\n')

    const mailOptions = {
      from: this.configService.get('smtp.email', { infer: true }),
      to: recipientEmail,
      subject: `Retrieval Job Upload Report – ${details.file_name} (${issueCount || details.hotel_count} issues)`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto;">
          <h3 style="margin-bottom:4px;">Retrieval Job Upload Report</h3>
          <p style="margin-top:0;color:#555;">
            File: <strong>${details.file_name}</strong> &nbsp;|&nbsp;
            Hotels: <strong>${details.hotel_count}</strong> &nbsp;|&nbsp;
            Successful: <strong style="color:#28a745">${successCount}</strong> &nbsp;|&nbsp;
            Issues: <strong style="color:${issueCount ? '#dc3545' : '#28a745'}">${issueCount || details.hotel_count}</strong>
          </p>
          <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:12px 16px;border-radius:4px;margin:16px 0;">
            <strong>${headline}</strong>
          </div>
          ${
            rows.length
              ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;">
            <tr style="background:#f4f4f4;">
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Hotel Name</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Hotel ID</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">DBMS</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:center;">Scraper</th>
              <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Reason</th>
            </tr>
            ${tableRows}
          </table>`
              : ''
          }
          <p style="margin-top:20px;font-size:12px;color:#888;">VNP Solutions DBMS</p>
        </div>
      `,
      text: [
        `Retrieval Job Upload Report for file ${details.file_name}.`,
        `Hotels: ${details.hotel_count} | Successful: ${successCount} | Issues: ${issueCount || details.hotel_count}`,
        headline,
        textLines
      ]
        .filter(Boolean)
        .join('\n\n')
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('✓ Retrieval job assignment error email sent:', {
        to: recipientEmail,
        messageId: info.messageId
      })
    } catch (error) {
      console.error('✗ Failed to send retrieval job assignment error email:', error)
    }
  }
}
