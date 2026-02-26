import { Subportfolio } from '@prisma/client'
import { PaginatedResult } from '../../common/dto/query.dto'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CreateSubportfolioDto, SubportfolioQueryDto, UpdateSubportfolioDto } from './subportfolio.dto'

export type SubportfolioWithPortfolio = Subportfolio & {
  portfolio: { id: string; name: string }
}

export type SubportfolioWithCounts = SubportfolioWithPortfolio & {
  total_properties: number
}

export interface ISubportfolioRepository {
  create(data: CreateSubportfolioDto): Promise<SubportfolioWithPortfolio>
  findAll(queryOptions: { where: any; skip?: number; take?: number; orderBy?: any }): Promise<SubportfolioWithCounts[]>
  count(where: any): Promise<number>
  findById(id: string): Promise<SubportfolioWithCounts | null>
  findByName(name: string): Promise<Subportfolio | null>
  findByPortfolioId(portfolioId: string): Promise<SubportfolioWithPortfolio[]>
  update(id: string, data: UpdateSubportfolioDto): Promise<SubportfolioWithPortfolio>
  delete(id: string): Promise<Subportfolio>
  getAccessibleSubportfolioIds(userId: string): Promise<string[] | 'all'>
  getAccessiblePortfolioIdsForSubportfolio(userId: string): Promise<string[] | 'all'>
}

export interface ISubportfolioService {
  create(data: CreateSubportfolioDto, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio>
  findAll(query: SubportfolioQueryDto, user: IUserWithPermissions): Promise<PaginatedResult<SubportfolioWithCounts>>
  findOne(id: string, user: IUserWithPermissions): Promise<SubportfolioWithCounts>
  findByPortfolioId(portfolioId: string, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio[]>
  update(id: string, data: UpdateSubportfolioDto, user: IUserWithPermissions): Promise<SubportfolioWithPortfolio>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
}
