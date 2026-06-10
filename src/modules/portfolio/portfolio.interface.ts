import { Portfolio, ServiceType } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'

export type PortfolioWithCounts = Portfolio & {
  total_properties: number
  total_subportfolios: number
  service_type: ServiceType | null
}

export interface IPortfolioRepository {
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
}
