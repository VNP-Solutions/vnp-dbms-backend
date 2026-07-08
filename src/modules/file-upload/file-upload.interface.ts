import { File as FileModel, Prisma } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateFileDto, FileQueryDto, UpdateFileDto } from './file-upload.dto'

export interface IFileUploadService {
  uploadFile(file: Express.Multer.File): Promise<FileUploadResponse>
  uploadBulkFiles(files: Express.Multer.File[]): Promise<BulkFileUploadResponse>
  createFile(data: CreateFileDto, user: IUserWithPermissions): Promise<FileWithRelations>
  findAllFiles(query: FileQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<FileWithRelations>>
  findOneFile(id: string, user: IUserWithPermissions): Promise<FileWithRelations>
  findFilesByPortfolio(portfolioId: string, user: IUserWithPermissions): Promise<FileWithRelations[]>
  updateFile(id: string, data: UpdateFileDto, user: IUserWithPermissions): Promise<FileWithRelations>
  removeFile(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}

export interface FileUploadResponse {
  url: string
  key: string
  originalName: string
  size: number
  mimetype: string
}

export interface BulkFileUploadResponse {
  files: FileUploadResponse[]
  totalFiles: number
  successfulUploads: number
  failedUploads: number
  errors?: string[]
}

export type FileWithRelations = Prisma.FileGetPayload<{
  include: {
    portfolio: { select: { id: true; name: true } }
    uploadedBy: {
      select: { id: true; first_name: true; last_name: true; email: true }
    }
  }
}>

export interface IFileRepository {
  create(data: {
    url: string
    name: string
    description?: string
    portfolio_id?: string
    uploaded_by: string
    is_active?: boolean
  }): Promise<FileWithRelations>
  findMany(options: {
    where?: Prisma.FileWhereInput
    skip?: number
    take?: number
    orderBy?:
      | Prisma.FileOrderByWithRelationInput
      | Prisma.FileOrderByWithRelationInput[]
  }): Promise<FileWithRelations[]>
  count(where?: Prisma.FileWhereInput): Promise<number>
  findById(id: string): Promise<FileWithRelations | null>
  findByPortfolioId(portfolioId: string): Promise<FileWithRelations[]>
  update(id: string, data: UpdateFileDto): Promise<FileWithRelations>
  delete(id: string): Promise<FileModel>
}