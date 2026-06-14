import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreatePriorityDto, ReorderPriorityDto, UpdatePriorityDto } from './priority.dto'
import type { IPriorityRepository, IPriorityService } from './priority.interface'

@Injectable()
export class PriorityService implements IPriorityService {
  constructor(
    @Inject('IPriorityRepository')
    private readonly repo: IPriorityRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreatePriorityDto, _user: IUserWithPermissions) {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Priority with this name already exists')
    return this.repo.create(data)
  }

  private async buildCountMap() {
    const [expCounts, bookCounts, agodaCounts] = await Promise.all([
      this.prisma.property.groupBy({ by: ['expedia_priority'], _count: { id: true }, where: { expedia_priority: { not: null } } }),
      this.prisma.property.groupBy({ by: ['booking_priority'], _count: { id: true }, where: { booking_priority: { not: null } } }),
      this.prisma.property.groupBy({ by: ['agoda_priority'], _count: { id: true }, where: { agoda_priority: { not: null } } })
    ])
    const expMap = new Map(expCounts.map(p => [p.expedia_priority, p._count.id]))
    const bookMap = new Map(bookCounts.map(p => [p.booking_priority, p._count.id]))
    const agodaMap = new Map(agodaCounts.map(p => [p.agoda_priority, p._count.id]))
    return { expMap, bookMap, agodaMap }
  }

  async findAll(_user: IUserWithPermissions) {
    const [items, { expMap, bookMap, agodaMap }] = await Promise.all([
      this.repo.findAll(),
      this.buildCountMap()
    ])
    return items.map(item => ({
      ...item,
      count: (expMap.get(item.name) ?? 0) + (bookMap.get(item.name) ?? 0) + (agodaMap.get(item.name) ?? 0)
    }))
  }

  async findAllExcept(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')
    const [items, { expMap, bookMap, agodaMap }] = await Promise.all([
      this.repo.findAllExcept(id),
      this.buildCountMap()
    ])
    return items.map(i => ({
      ...i,
      count: (expMap.get(i.name) ?? 0) + (bookMap.get(i.name) ?? 0) + (agodaMap.get(i.name) ?? 0)
    }))
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')
    return item
  }

  async update(id: string, data: UpdatePriorityDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')
    if (data.name && data.name !== item.name) {
      const duplicate = await this.repo.findByName(data.name)
      if (duplicate) throw new ConflictException('Priority with this name already exists')
    }
    return this.repo.update(id, data)
  }

  async toggle(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')
    return this.repo.update(id, { is_active: !item.is_active })
  }

  async reorder(id: string, data: ReorderPriorityDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')

    const currentOrder = item.order
    const newOrder = data.newOrder
    if (currentOrder === newOrder) return { message: 'Priority order unchanged' }

    const all = await this.repo.findAll()
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      all.forEach(i => {
        if (i.id === id) updates.push({ id: i.id, order: newOrder })
        else if (i.order > currentOrder && i.order <= newOrder) updates.push({ id: i.id, order: i.order - 1 })
      })
    } else {
      all.forEach(i => {
        if (i.id === id) updates.push({ id: i.id, order: newOrder })
        else if (i.order >= newOrder && i.order < currentOrder) updates.push({ id: i.id, order: i.order + 1 })
      })
    }

    await this.repo.updateMany(updates)
    return { message: 'Priority order updated successfully' }
  }

  async remove(id: string, password: string, replacementId: string, user: IUserWithPermissions) {
    const userFromDb = await this.prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    if (!userFromDb) throw new NotFoundException('User not found')

    const valid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!valid) throw new BadRequestException('Invalid password')

    if (id === replacementId) throw new BadRequestException('Replacement priority must be different from the one being deleted')

    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')

    const replacement = await this.repo.findById(replacementId)
    if (!replacement) throw new NotFoundException('Replacement priority not found')

    await this.prisma.$transaction([
      this.prisma.property.updateMany({ where: { expedia_priority: item.name }, data: { expedia_priority: replacement.name } }),
      this.prisma.property.updateMany({ where: { booking_priority: item.name }, data: { booking_priority: replacement.name } }),
      this.prisma.property.updateMany({ where: { agoda_priority: item.name }, data: { agoda_priority: replacement.name } }),
      this.prisma.priority.delete({ where: { id } })
    ])

    return { message: 'Priority deleted successfully' }
  }
}
