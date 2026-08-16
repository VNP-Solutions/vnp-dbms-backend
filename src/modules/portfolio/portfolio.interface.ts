import { Currency, File, Portfolio, ServiceType } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type { UploadAndCreateFileDto } from '../file-upload/file-upload.dto'
import type { FileWithRelations } from '../file-upload/file-upload.interface'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'

export type PortfolioContractUrl = {
  id: string
  url: string
  name: string
  description: string | null
  is_active: boolean
  uploaded_by: string
  portfolio_id: string | null
  created_at: Date
  updated_at: Date
}

export type PortfolioContact = {
  contact_email: string | null
  portfolio_contact_email: string | null
  portfolio_contact_name: string | null
  portfolio_contact_phone: string | null
}

export type PortfolioWithCounts = Portfolio & {
  total_properties: number
  total_subportfolios: number
  service_type: ServiceType | null
  currency: Currency | null
  contract_urls: File[]
}

export interface IPortfolioRepository {
  reassignPropertiesToPortfolio(
    fromPortfolioId: string,
    toPortfolioId: string
  ): Promise<number>
  create(data: CreatePortfolioDto): Promise<Portfolio>
  findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PortfolioWithCounts[]>
  count(where: any): Promise<number>
  findById(id: string): Promise<PortfolioWithCounts | null>
  findByName(name: string): Promise<Portfolio | null>
  update(id: string, data: UpdatePortfolioDto): Promise<Portfolio>
  delete(id: string): Promise<Portfolio>
  countProperties(portfolioId: string): Promise<number>
  findContractUrls(portfolioId: string): Promise<File[]>
  getAccessiblePortfolioIds(userId: string): Promise<string[] | 'all'>
}

export interface SkippedPortfolio {
  row_no: number
  portfolio_name: string
  reason: string
}

export interface ImportPortfoliosResult {
  portfoliosCreated: number
  portfolios: any[]
  skipped_portfolios: SkippedPortfolio[]
}

export interface IPortfolioService {
  create(data: CreatePortfolioDto, user: IUserWithPermissions): Promise<Portfolio>
  findAll(query: PortfolioQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<PortfolioWithCounts>>
  findAllCached(user: IUserWithPermissions): Promise<PortfolioWithCounts[]>
  findOne(id: string, user: IUserWithPermissions): Promise<PortfolioWithCounts>
  update(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions): Promise<Portfolio>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  importFromExcel(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPortfoliosResult>
  getContractUrls(id: string, user: IUserWithPermissions): Promise<File[]>
  getContact(id: string, user: IUserWithPermissions): Promise<PortfolioContact>
  getContactExternal(id: string): Promise<PortfolioContact>
  getContractUrlsExternal(id: string): Promise<File[]>
  uploadContractUrls(
    id: string,
    files: Express.Multer.File[],
    dto: UploadAndCreateFileDto,
    user: IUserWithPermissions
  ): Promise<{ created: FileWithRelations[]; failed: string[] }>
  deleteContractUrl(
    id: string,
    fileId: string,
    user: IUserWithPermissions
  ): Promise<{ message: string }>
  bulkDeleteContractUrls(
    id: string,
    fileIds: string[],
    user: IUserWithPermissions
  ): Promise<{ deleted: string[]; failed: Array<{ fileId: string; reason: string }> }>
  createAndSync(data: CreatePortfolioDto, user: IUserWithPermissions): Promise<Portfolio>
  updateAndSync(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions): Promise<Portfolio>
  removeAndSync(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  /**
   * Single-portfolio upsert to scraper + dashboard, used by the property
   * bulk import/update upload-job pipeline. Never throws — each target's
   * outcome is reported independently so the caller can track per-system
   * status. `timeoutMs`, when provided, overrides the client's default
   * axios timeout for this call only (see UPLOAD_JOB_HTTP_TIMEOUT_MS).
   */
  syncUpsertPortfolioToScraperAndDashboard(
    portfolioId: string,
    timeoutMs?: number
  ): Promise<{
    scraper: { success: boolean; reason?: string }
    dashboard: { success: boolean; reason?: string }
  }>
}
