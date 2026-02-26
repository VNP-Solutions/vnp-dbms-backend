export interface IFileUploadService {
  uploadFile(file: Express.Multer.File): Promise<FileUploadResponse>
  uploadBulkFiles(files: Express.Multer.File[]): Promise<BulkFileUploadResponse>
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
