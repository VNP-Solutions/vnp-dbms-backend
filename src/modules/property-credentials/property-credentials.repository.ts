import { Injectable, Logger } from '@nestjs/common'
import type { PropertyCredentials } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import type {
  BulkUpdatePropertyCredentialsDto,
  CreatePropertyCredentialsDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'
import type { IPropertyCredentialsRepository } from './property-credentials.interface'

@Injectable()
export class PropertyCredentialsRepository implements IPropertyCredentialsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionUtil: EncryptionUtil,
    private readonly logger: Logger
  ) {}

  private encryptPassword(password: string): string {
    if (!password) return ''
    return this.encryptionUtil.encryptPassword(password)
  }

  async create(data: CreatePropertyCredentialsDto): Promise<PropertyCredentials> {
    try {
      const { property_id, ...credentialsData } = data

      const encryptedData: any = { ...credentialsData }
      if (credentialsData.expediaPassword) {
        encryptedData.expediaPassword = this.encryptPassword(credentialsData.expediaPassword)
      }
      if (credentialsData.agodaPassword) {
        encryptedData.agodaPassword = this.encryptPassword(credentialsData.agodaPassword)
      }
      if (credentialsData.bookingPassword) {
        encryptedData.bookingPassword = this.encryptPassword(credentialsData.bookingPassword)
      }
      if (credentialsData.expediaSecondaryPassword) {
        encryptedData.expediaSecondaryPassword = this.encryptPassword(
          credentialsData.expediaSecondaryPassword
        )
      }
      if (credentialsData.bookingSecondaryPassword) {
        encryptedData.bookingSecondaryPassword = this.encryptPassword(
          credentialsData.bookingSecondaryPassword
        )
      }
      if (credentialsData.agodaSecondaryPassword) {
        encryptedData.agodaSecondaryPassword = this.encryptPassword(
          credentialsData.agodaSecondaryPassword
        )
      }

      return await this.prisma.propertyCredentials.create({
        data: {
          ...encryptedData,
          property: {
            connect: { id: property_id }
          }
        }
      })
    } catch (error) {
      this.logger.error(`Error creating property credentials: ${error}`)
      throw error
    }
  }

  async findAll(): Promise<PropertyCredentials[]> {
    return this.prisma.propertyCredentials.findMany({
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findById(id: string): Promise<PropertyCredentials | null> {
    return this.prisma.propertyCredentials.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async findByPropertyId(propertyId: string): Promise<PropertyCredentials | null> {
    return this.prisma.propertyCredentials.findFirst({
      where: { property_id: propertyId },
      include: {
        property: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  }

  async update(id: string, data: UpdatePropertyCredentialsDto): Promise<PropertyCredentials> {
    const encryptedData: any = { ...data }
    
    if (data.expediaPassword) {
      encryptedData.expediaPassword = this.encryptPassword(data.expediaPassword)
    } else if (data.expediaPassword === '') {
      delete encryptedData.expediaPassword
    }

    if (data.agodaPassword) {
      encryptedData.agodaPassword = this.encryptPassword(data.agodaPassword)
    } else if (data.agodaPassword === '') {
      delete encryptedData.agodaPassword
    }

    if (data.bookingPassword) {
      encryptedData.bookingPassword = this.encryptPassword(data.bookingPassword)
    } else if (data.bookingPassword === '') {
      delete encryptedData.bookingPassword
    }

    if (data.expediaSecondaryPassword) {
      encryptedData.expediaSecondaryPassword = this.encryptPassword(
        data.expediaSecondaryPassword
      )
    } else if (data.expediaSecondaryPassword === '') {
      delete encryptedData.expediaSecondaryPassword
    }

    if (data.bookingSecondaryPassword) {
      encryptedData.bookingSecondaryPassword = this.encryptPassword(
        data.bookingSecondaryPassword
      )
    } else if (data.bookingSecondaryPassword === '') {
      delete encryptedData.bookingSecondaryPassword
    }

    if (data.agodaSecondaryPassword) {
      encryptedData.agodaSecondaryPassword = this.encryptPassword(
        data.agodaSecondaryPassword
      )
    } else if (data.agodaSecondaryPassword === '') {
      delete encryptedData.agodaSecondaryPassword
    }

    delete encryptedData.property_id

    return this.prisma.propertyCredentials.update({
      where: { id },
      data: encryptedData
    })
  }

  async delete(id: string): Promise<PropertyCredentials> {
    return this.prisma.propertyCredentials.delete({
      where: { id }
    })
  }

  async bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto
  ): Promise<{ success: PropertyCredentials[]; failed: any[] }> {
    const success: PropertyCredentials[] = []
    const failed: any[] = []

    try {
      this.logger.log(`Starting bulk update for ${data.propertyIds.length} properties`)

      const encryptedCredentials: any = { ...data.credentials }

      if (data.credentials.expediaPassword && data.credentials.expediaPassword.trim() !== '') {
        encryptedCredentials.expediaPassword = this.encryptPassword(data.credentials.expediaPassword)
      } else {
        delete encryptedCredentials.expediaPassword
      }

      if (data.credentials.agodaPassword && data.credentials.agodaPassword.trim() !== '') {
        encryptedCredentials.agodaPassword = this.encryptPassword(data.credentials.agodaPassword)
      } else {
        delete encryptedCredentials.agodaPassword
      }

      if (data.credentials.bookingPassword && data.credentials.bookingPassword.trim() !== '') {
        encryptedCredentials.bookingPassword = this.encryptPassword(data.credentials.bookingPassword)
      } else {
        delete encryptedCredentials.bookingPassword
      }

      if (
        data.credentials.expediaSecondaryPassword &&
        data.credentials.expediaSecondaryPassword.trim() !== ''
      ) {
        encryptedCredentials.expediaSecondaryPassword = this.encryptPassword(
          data.credentials.expediaSecondaryPassword
        )
      } else {
        delete encryptedCredentials.expediaSecondaryPassword
      }

      if (
        data.credentials.bookingSecondaryPassword &&
        data.credentials.bookingSecondaryPassword.trim() !== ''
      ) {
        encryptedCredentials.bookingSecondaryPassword = this.encryptPassword(
          data.credentials.bookingSecondaryPassword
        )
      } else {
        delete encryptedCredentials.bookingSecondaryPassword
      }

      if (
        data.credentials.agodaSecondaryPassword &&
        data.credentials.agodaSecondaryPassword.trim() !== ''
      ) {
        encryptedCredentials.agodaSecondaryPassword = this.encryptPassword(
          data.credentials.agodaSecondaryPassword
        )
      } else {
        delete encryptedCredentials.agodaSecondaryPassword
      }

      Object.keys(encryptedCredentials).forEach((key) => {
        if (
          encryptedCredentials[key] === '' ||
          encryptedCredentials[key] === null ||
          encryptedCredentials[key] === undefined
        ) {
          delete encryptedCredentials[key]
        }
      })

      delete encryptedCredentials.property_id

      for (const propertyId of data.propertyIds) {
        try {
          this.logger.log(`Processing property: ${propertyId}`)

          const existingCredential = await this.prisma.propertyCredentials.findFirst({
            where: { property_id: propertyId }
          })

          let updatedCredential: PropertyCredentials

          if (existingCredential) {
            this.logger.log(`Updating existing credentials for property ${propertyId}`)
            updatedCredential = await this.prisma.propertyCredentials.update({
              where: { id: existingCredential.id },
              data: encryptedCredentials
            })
          } else {
            this.logger.log(`Creating new credentials for property ${propertyId}`)
            updatedCredential = await this.prisma.propertyCredentials.create({
              data: {
                ...encryptedCredentials,
                property_id: propertyId
              }
            })
          }

          success.push(updatedCredential)
        } catch (error: any) {
          this.logger.error(`Error processing property ${propertyId}: ${error.message}`)
          failed.push({
            propertyId,
            error: error.message
          })
        }
      }

      this.logger.log(`Bulk update completed. Success: ${success.length}, Failed: ${failed.length}`)
      return { success, failed }
    } catch (error: any) {
      this.logger.error(`Error in bulk update: ${error.message}`, error.stack)
      throw error
    }
  }
}
