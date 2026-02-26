import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './service-type.dto'
import type { IServiceTypeRepository } from './service-type.interface'

@Injectable()
export class ServiceTypeRepository implements IServiceTypeRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async create(data: CreateServiceTypeDto) {
    const count = await this.prisma.serviceType.count()
    return this.prisma.serviceType.create({
      data: {
        ...data,
        order: count + 1
      }
    })
  }

  async findAll() {
    return this.prisma.serviceType.findMany({
      orderBy: {
        order: 'asc'
      }
    })
  }

  async findById(id: string) {
    return this.prisma.serviceType.findUnique({
      where: { id }
    })
  }

  async findByType(type: string) {
    return this.prisma.serviceType.findUnique({
      where: { type }
    })
  }

  async update(id: string, data: UpdateServiceTypeDto) {
    return this.prisma.serviceType.update({
      where: { id },
      data
    })
  }

  async delete(id: string) {
    return this.prisma.serviceType.delete({
      where: { id }
    })
  }

  async countPortfolios(serviceTypeId: string): Promise<number> {
    return this.prisma.portfolio.count({
      where: { service_type_id: serviceTypeId }
    })
  }

  async count(): Promise<number> {
    return this.prisma.serviceType.count()
  }

  async updateMany(data: Array<{ id: string; order: number }>): Promise<void> {
    const updates = data.map(item =>
      this.prisma.serviceType.update({
        where: { id: item.id },
        data: { order: item.order }
      })
    )

    await this.prisma.$transaction([...updates] as any, {
      timeout: 10000 // 10 seconds timeout for bulk order updates
    })
  }
}
