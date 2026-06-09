import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBillingTypeDto, UpdateBillingTypeDto } from './billing-type.dto'
import type { IBillingTypeRepository } from './billing-type.interface'

@Injectable()
export class BillingTypeRepository implements IBillingTypeRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateBillingTypeDto) {
    const last = await this.prisma.billingType.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    return this.prisma.billingType.create({ data: { ...data, order: (last?.order ?? 0) + 1 } })
  }

  findAll() {
    return this.prisma.billingType.findMany({ orderBy: { order: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.billingType.findUnique({ where: { id } })
  }

  findByName(name: string) {
    return this.prisma.billingType.findUnique({ where: { name } })
  }

  update(id: string, data: UpdateBillingTypeDto) {
    return this.prisma.billingType.update({ where: { id }, data })
  }

  delete(id: string) {
    return this.prisma.billingType.delete({ where: { id } })
  }

  count() {
    return this.prisma.billingType.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    const updates = data.map(item =>
      this.prisma.billingType.update({ where: { id: item.id }, data: { order: item.order } })
    )
    await this.prisma.$transaction([...updates] as any, { timeout: 10000 })
  }
}
