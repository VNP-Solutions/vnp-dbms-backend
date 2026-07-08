import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateFileDto } from './file-upload.dto'
import type { IFileRepository } from './file-upload.interface'

export const fileInclude = {
  portfolio: { select: { id: true, name: true } },
  uploadedBy: {
    select: { id: true, first_name: true, last_name: true, email: true }
  }
} satisfies Prisma.FileInclude

@Injectable()
export class FileRepository implements IFileRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(data: {
    url: string
    name: string
    description?: string
    portfolio_id?: string
    uploaded_by: string
    is_active?: boolean
  }) {
    return this.prisma.file.create({ data, include: fileInclude })
  }

  findMany(options: {
    where?: Prisma.FileWhereInput
    skip?: number
    take?: number
    orderBy?:
      | Prisma.FileOrderByWithRelationInput
      | Prisma.FileOrderByWithRelationInput[]
  }) {
    return this.prisma.file.findMany({ ...options, include: fileInclude })
  }

  count(where?: Prisma.FileWhereInput) {
    return this.prisma.file.count({ where })
  }

  findById(id: string) {
    return this.prisma.file.findUnique({ where: { id }, include: fileInclude })
  }

  findByPortfolioId(portfolioId: string) {
    return this.prisma.file.findMany({
      where: { portfolio_id: portfolioId },
      orderBy: { created_at: 'desc' },
      include: fileInclude
    })
  }

  update(id: string, data: UpdateFileDto) {
    return this.prisma.file.update({ where: { id }, data, include: fileInclude })
  }

  delete(id: string) {
    return this.prisma.file.delete({ where: { id } })
  }
}