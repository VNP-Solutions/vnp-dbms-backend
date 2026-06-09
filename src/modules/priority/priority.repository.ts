import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePriorityDto, UpdatePriorityDto } from './priority.dto'
import type { IPriorityRepository } from './priority.interface'

@Injectable()
export class PriorityRepository implements IPriorityRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreatePriorityDto) {
    const last = await this.prisma.priority.findFirst({ orderBy: { order: 'desc' }, select: { order: true } })
    return this.prisma.priority.create({ data: { ...data, order: (last?.order ?? 0) + 1 } })
  }

  findAll() {
    return this.prisma.priority.findMany({ orderBy: { order: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.priority.findUnique({ where: { id } })
  }

  findByName(name: string) {
    return this.prisma.priority.findUnique({ where: { name } })
  }

  update(id: string, data: UpdatePriorityDto) {
    return this.prisma.priority.update({ where: { id }, data })
  }

  delete(id: string) {
    return this.prisma.priority.delete({ where: { id } })
  }

  count() {
    return this.prisma.priority.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    const updates = data.map(item =>
      this.prisma.priority.update({ where: { id: item.id }, data: { order: item.order } })
    )
    await this.prisma.$transaction([...updates] as any, { timeout: 10000 })
  }
}
