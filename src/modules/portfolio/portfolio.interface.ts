import { Portfolio } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'

export type PortfolioWithServiceType = Portfolio & {
  serviceType: { id: string; type: string; is_active: boolean }
}

export type PortfolioWithCounts = PortfolioWithServiceType & {
  total_properties: number
  total_subportfolios: number
}

export interface IPortfolioRepository {
  create(data: CreatePortfolioDto): Promise<PortfolioWithServiceType>
  findAll(queryOptions: {
    where: any
    skip?: number
    take?: number
    orderBy?: any
  }): Promise<PortfolioWithCounts[]>
  count(where: any): Promise<number>
  findById(id: string): Promise<PortfolioWithCounts | null>
  findByName(name: string): Promise<Portfolio | null>
  update(id: string, data: UpdatePortfolioDto): Promise<PortfolioWithServiceType>
  delete(id: string): Promise<Portfolio>
  countProperties(portfolioId: string): Promise<number>
  getAccessiblePortfolioIds(userId: string): Promise<string[] | 'all'>
}

export interface ImportPortfoliosResult {
  portfoliosCreated: number
  portfolios: any[]
}

export interface IPortfolioService {
  create(data: CreatePortfolioDto, user: IUserWithPermissions): Promise<PortfolioWithServiceType>
  findAll(query: PortfolioQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<PortfolioWithCounts>>
  findOne(id: string, user: IUserWithPermissions): Promise<PortfolioWithCounts>
  update(id: string, data: UpdatePortfolioDto, user: IUserWithPermissions): Promise<PortfolioWithServiceType>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  importFromExcel(
    file: Express.Multer.File,
    user: IUserWithPermissions
  ): Promise<ImportPortfoliosResult>
}
