import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateFrequencyDto, UpdateFrequencyDto } from './frequency.dto'
import type { IFrequencyRepository } from './frequency.interface'

@Injectable()
export class FrequencyRepository implements IFrequencyRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateFrequencyDto) {
    const last = await this.prisma.frequency.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    return this.prisma.frequency.create({ data: { ...data, order: (last?.order ?? 0) + 1 } })
  }

  private mapWithCount(items: any[]) {
    return items.map(({ _count, ...rest }) => ({
      ...rest,
      count:
        (_count.expedia_properties ?? 0) +
        (_count.booking_properties ?? 0) +
        (_count.agoda_properties ?? 0)
    }))
  }

  findAll() {
    return this.prisma.frequency.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            expedia_properties: true,
            booking_properties: true,
            agoda_properties: true
          }
        }
      }
    }).then(items => this.mapWithCount(items))
  }

  findAllExcept(id: string) {
    return this.prisma.frequency.findMany({
      where: { id: { not: id } },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            expedia_properties: true,
            booking_properties: true,
            agoda_properties: true
          }
        }
      }
    }).then(items => this.mapWithCount(items))
  }

  findById(id: string) {
    return this.prisma.frequency.findUnique({ where: { id } })
  }

  findByName(name: string) {
    return this.prisma.frequency.findUnique({ where: { name } })
  }

  update(id: string, data: UpdateFrequencyDto) {
    return this.prisma.frequency.update({ where: { id }, data })
  }

  delete(id: string) {
    return this.prisma.frequency.delete({ where: { id } })
  }

  count() {
    return this.prisma.frequency.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    const updates = data.map(item =>
      this.prisma.frequency.update({ where: { id: item.id }, data: { order: item.order } })
    )
    await this.prisma.$transaction([...updates] as any, { timeout: 10000 })
  }
}
