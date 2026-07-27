import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { PropertyCredentials } from '@prisma/client'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import type {
  BulkUpdatePropertyCredentialsDto,
  CreatePropertyCredentialsDto,
  UpdatePropertyCredentialsDto
} from './property-credentials.dto'
import type {
  IPropertyCredentialsRepository,
  IPropertyCredentialsService
} from './property-credentials.interface'

const PASSWORD_FIELDS = [
  'expediaPassword',
  'agodaPassword',
  'bookingPassword',
  'expediaSecondaryPassword',
  'bookingSecondaryPassword',
  'agodaSecondaryPassword'
] as const

@Injectable()
export class PropertyCredentialsService implements IPropertyCredentialsService {
  constructor(
    @Inject('IPropertyCredentialsRepository')
    private readonly repository: IPropertyCredentialsRepository,
    private readonly encryptionUtil: EncryptionUtil,
    private readonly logger: Logger
  ) {}

  async create(data: CreatePropertyCredentialsDto): Promise<PropertyCredentials> {
    try {
      return await this.repository.create(data)
    } catch (error: any) {
      this.logger.error(`Error creating property credentials: ${error.message}`, error.stack)
      throw error
    }
  }

  async findAll(): Promise<PropertyCredentials[]> {
    try {
      return await this.repository.findAll()
    } catch (error: any) {
      this.logger.error(`Error getting property credentials: ${error.message}`, error.stack)
      throw error
    }
  }

  async findOne(id: string): Promise<PropertyCredentials> {
    try {
      const credentials = await this.repository.findById(id)
      if (!credentials) {
        throw new NotFoundException(`Property credentials with ID ${id} not found`)
      }
      return credentials
    } catch (error: any) {
      this.logger.error(`Error finding property credentials: ${error.message}`, error.stack)
      throw error
    }
  }

  async findByPropertyId(propertyId: string): Promise<PropertyCredentials | null> {
    try {
      return await this.repository.findByPropertyId(propertyId)
    } catch (error: any) {
      this.logger.error(
        `Error finding property credentials by property ID: ${error.message}`,
        error.stack
      )
      throw error
    }
  }

  async findByPropertyIdUnmasked(propertyId: string): Promise<PropertyCredentials> {
    const creds = await this.repository.findByPropertyId(propertyId)
    if (!creds) {
      throw new NotFoundException(`No credentials found for property "${propertyId}"`)
    }

    const result: any = { ...creds }
    for (const field of PASSWORD_FIELDS) {
      if (creds[field]) {
        try {
          result[field] = this.encryptionUtil.decrypt(creds[field] as string)
        } catch {
          result[field] = creds[field]
        }
      }
    }
    return result as PropertyCredentials
  }

  async update(id: string, data: UpdatePropertyCredentialsDto): Promise<PropertyCredentials> {
    try {
      await this.findOne(id)
      return await this.repository.update(id, data)
    } catch (error: any) {
      this.logger.error(`Error updating property credentials: ${error.message}`, error.stack)
      throw error
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      await this.findOne(id)
      await this.repository.delete(id)
      return { message: 'Property credentials deleted successfully' }
    } catch (error: any) {
      this.logger.error(`Error deleting property credentials: ${error.message}`, error.stack)
      throw error
    }
  }

  async bulkUpdate(
    data: BulkUpdatePropertyCredentialsDto
  ): Promise<{ success: PropertyCredentials[]; failed: any[]; summary: any }> {
    try {
      const result = await this.repository.bulkUpdate(data)

      this.logger.log(
        `Bulk update completed. Success: ${result.success.length}, Failed: ${result.failed.length}`
      )

      return {
        ...result,
        summary: {
          total: data.propertyIds.length,
          success: result.success.length,
          failed: result.failed.length
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Error in bulk update property credentials: ${error.message}`,
        error.stack
      )
      throw error
    }
  }
}
