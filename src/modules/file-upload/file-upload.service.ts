import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import type {
  BulkFileUploadResponse,
  FileUploadResponse,
  IFileUploadService,
  FileWithRelations,
  IFileRepository
} from './file-upload.interface'
import { Inject, NotFoundException } from '@nestjs/common'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { QueryBuilder } from '../../common/utils/query-builder.util'
import type { IPortfolioRepository } from '../portfolio/portfolio.interface'
import { FileQueryDto, UpdateFileDto, UploadAndCreateFileDto } from './file-upload.dto'

// const fileInclude = {
//   portfolio: { select: { id: true, name: true } },
//   uploadedBy: {
//     select: { id: true, first_name: true, last_name: true, email: true }
//   }
// } satisfies Prisma.FileInclude

@Injectable()
export class FileUploadService implements IFileUploadService {
  private readonly s3Client: S3Client
  private readonly bucketName: string
  private readonly bucketUrl: string

  constructor(private readonly configService: ConfigService,
    @Inject('IFileRepository')
    private readonly fileRepository: IFileRepository,
    @Inject('IPortfolioRepository')
    private readonly portfolioRepository: IPortfolioRepository) {
    const s3Config = this.configService.s3

    this.s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKey,
        secretAccessKey: s3Config.secretKey
      }
    })

    this.bucketName = s3Config.bucketName
    this.bucketUrl = s3Config.bucketUrl
  }

  async uploadFile(file: Express.Multer.File): Promise<FileUploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided')
    }

    const timestamp = Date.now()
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    const key = `uploads/${timestamp}-${sanitizedFileName}`

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype
          // ACL: 'public-read'
        }
      })

      await upload.done()

      const url = `${this.bucketUrl}/${key}`

      return {
        url,
        key,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  async uploadBulkFiles(
    files: Express.Multer.File[]
  ): Promise<BulkFileUploadResponse> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided')
    }

    const uploadedFiles: FileUploadResponse[] = []
    const errors: string[] = []

    // Upload files in parallel using Promise.allSettled
    const uploadPromises = files.map(async (file, index) => {
      const timestamp = Date.now()
      const sanitizedFileName = file.originalname.replace(
        /[^a-zA-Z0-9.-]/g,
        '_'
      )
      const key = `uploads/${timestamp}-${index}-${sanitizedFileName}`

      try {
        const upload = new Upload({
          client: this.s3Client,
          params: {
            Bucket: this.bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
            // ACL: 'public-read'
          }
        })

        await upload.done()

        const url = `${this.bucketUrl}/${key}`

        return {
          success: true,
          data: {
            url,
            key,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype
          }
        }
      } catch (error) {
        return {
          success: false,
          error: `Failed to upload ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    })

    const results = await Promise.allSettled(uploadPromises)

    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        uploadedFiles.push(result.value.data)
      } else if (result.status === 'fulfilled' && !result.value.success && result.value.error) {
        errors.push(result.value.error)
      } else if (result.status === 'rejected') {
        errors.push(result.reason?.message || 'Unknown error occurred')
      }
    })

    return {
      files: uploadedFiles,
      totalFiles: files.length,
      successfulUploads: uploadedFiles.length,
      failedUploads: errors.length,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  private async assertPortfolioAccess(
    user: IUserWithPermissions,
    portfolioId?: string | null
  ) {
    if (!portfolioId) return

    const portfolio = await this.portfolioRepository.findById(portfolioId)
    if (!portfolio) throw new NotFoundException('Portfolio not found')

    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)

    if (
      accessibleIds !== 'all' &&
      Array.isArray(accessibleIds) &&
      !accessibleIds.includes(portfolioId)
    ) {
      throw new NotFoundException('Portfolio not found')
    }
  }

  private async buildScopedWhere(user: IUserWithPermissions) {
    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)

    if (accessibleIds === 'all') return {}

    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
      return { OR: [{ portfolio_id: null, uploaded_by: user.id }] }
    }

    return {
      OR: [
        { portfolio_id: { in: accessibleIds } },
        { portfolio_id: null, uploaded_by: user.id }
      ]
    }
  }

  private async assertCanAccessFile(
    file: FileWithRelations,
    user: IUserWithPermissions
  ) {
    if (file.portfolio_id) {
      await this.assertPortfolioAccess(user, file.portfolio_id)
      return
    }
    if (file.uploaded_by === user.id) return

    const accessibleIds =
      await this.portfolioRepository.getAccessiblePortfolioIds(user.id)
    if (accessibleIds !== 'all') {
      throw new NotFoundException('File not found')
    }
  }

  async createFile(
    file: Express.Multer.File,
    data: UploadAndCreateFileDto,
    user: IUserWithPermissions
  ) {
    if (!file) throw new BadRequestException('No file provided')
  
    const portfolioId = data.portfolio_id?.trim() || undefined
    const description = data.description?.trim() || undefined
  
    await this.assertPortfolioAccess(user, portfolioId)
  
    const uploaded = await this.uploadFile(file)
  
    return this.fileRepository.create({
      url: uploaded.url,
      name: uploaded.originalName,
      description,
      portfolio_id: portfolioId,
      uploaded_by: user.id,
      is_active: true
    })
  }

  async findAllFiles(
    query: FileQueryDto,
    user: IUserWithPermissions
  ): Promise<PaginatedResult<FileWithRelations>> {
    const baseWhere = await this.buildScopedWhere(user)

    const additionalFilters: Record<string, unknown> = {}
    if (query.portfolio_id) additionalFilters.portfolio_id = query.portfolio_id
    if (query.uploaded_by) additionalFilters.uploaded_by = query.uploaded_by
    if (query.is_active !== undefined && query.is_active !== 'All') {
      additionalFilters.is_active = query.is_active === 'true'
    }

    const mergedQuery = {
      ...query,
      filters: {
        ...(typeof query.filters === 'object' ? query.filters : {}),
        ...additionalFilters
      }
    }

    const queryConfig = {
      searchFields: ['name', 'url', 'description'],
      filterableFields: ['portfolio_id', 'is_active', 'uploaded_by'],
      sortableFields: ['name', 'url', 'created_at', 'updated_at', 'is_active'],
      defaultSortField: 'created_at',
      defaultSortOrder: 'desc' as const,
      nestedFieldMap: {
        portfolio_name: 'portfolio.name',
        uploaded_by_name: 'uploadedBy.first_name'
      }
    }

    const { where, skip, take, orderBy, usePagination } =
      QueryBuilder.buildPrismaQuery(mergedQuery, queryConfig, baseWhere)

    const [data, total] = await Promise.all([
        this.fileRepository.findMany({ where, skip, take, orderBy }),
        this.fileRepository.count(where)
    ])

    const totalPages = usePagination ? Math.ceil(total / (take || 10)) || 1 : 1
    const currentPage = usePagination ? query.page || 1 : 1
    const limit = usePagination ? take || 10 : data.length

    return {
      data,
      metadata: { totalDocuments: total, currentPage, totalPages, limit }
    }
  }

  async findOneFile(id: string, user: IUserWithPermissions) {
    const file = await this.fileRepository.findById(id)
    if (!file) throw new NotFoundException('File not found')

    await this.assertCanAccessFile(file, user)
    return file
  }

  async findFilesByPortfolio(portfolioId: string, user: IUserWithPermissions) {
    await this.assertPortfolioAccess(user, portfolioId)
    return this.fileRepository.findByPortfolioId(portfolioId)
  }

  async updateFile(id: string, data: UpdateFileDto, user: IUserWithPermissions) {
    const existing = await this.findOneFile(id, user)
    if (data.portfolio_id && data.portfolio_id !== existing.portfolio_id) {
      await this.assertPortfolioAccess(user, data.portfolio_id)
    }
    return this.fileRepository.update(id, data)
  }

  async removeFile(id: string, user: IUserWithPermissions) {
    await this.findOneFile(id, user)
    await this.fileRepository.delete(id)
    return { message: 'File deleted successfully' }
  }
}
