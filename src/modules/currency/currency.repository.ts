import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCurrencyDto, UpdateCurrencyDto } from './currency.dto'
import type { ICurrencyRepository } from './currency.interface'

@Injectable()
export class CurrencyRepository implements ICurrencyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateCurrencyDto) {
    const count = await this.prisma.currency.count()
    return this.prisma.currency.create({
      data: {
        ...data,
        order: count + 1
      }
    })
  }

  async findAll() {
    return this.prisma.currency.findMany({
      orderBy: {
        order: 'asc'
      }
    })
  }

  async findById(id: string) {
    return this.prisma.currency.findUnique({
      where: { id }
    })
  }

  async findByCode(code: string) {
    return this.prisma.currency.findUnique({
      where: { code }
    })
  }

  async update(id: string, data: UpdateCurrencyDto) {
    return this.prisma.currency.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.currency.delete({
      where: { id }
    })
  }

  async countProperties(currencyId: string): Promise<number> {
    return this.prisma.property.count({
      where: { currency_id: currencyId }
    })
  }

  async count(): Promise<number> {
    return this.prisma.currency.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    const updates = data.map(item =>
      this.prisma.currency.update({
        where: { id: item.id },
        data: { order: item.order }
      })
    )

    await this.prisma.$transaction([...updates] as any, {
      timeout: 10000 // 10 seconds timeout for bulk order updates
    })
  }
}
