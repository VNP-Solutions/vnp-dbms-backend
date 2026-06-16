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
      this.prisma.property.groupBy({ by: ['expedia_priority_id'], _count: { id: true }, where: { expedia_priority_id: { not: null } } }),
      this.prisma.property.groupBy({ by: ['booking_priority_id'], _count: { id: true }, where: { booking_priority_id: { not: null } } }),
      this.prisma.property.groupBy({ by: ['agoda_priority_id'], _count: { id: true }, where: { agoda_priority_id: { not: null } } })
    ])
    const expMap = new Map(expCounts.map(p => [p.expedia_priority_id, p._count.id]))
    const bookMap = new Map(bookCounts.map(p => [p.booking_priority_id, p._count.id]))
    const agodaMap = new Map(agodaCounts.map(p => [p.agoda_priority_id, p._count.id]))
    return { expMap, bookMap, agodaMap }
  }

  async findAll(_user: IUserWithPermissions) {
    const [items, { expMap, bookMap, agodaMap }] = await Promise.all([
      this.repo.findAll(),
      this.buildCountMap()
    ])
    return items.map(item => ({
      ...item,
      count: (expMap.get(item.id) ?? 0) + (bookMap.get(item.id) ?? 0) + (agodaMap.get(item.id) ?? 0)
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
      count: (expMap.get(i.id) ?? 0) + (bookMap.get(i.id) ?? 0) + (agodaMap.get(i.id) ?? 0)
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
      this.prisma.property.updateMany({ where: { expedia_priority_id: id }, data: { expedia_priority_id: replacementId } }),
      this.prisma.property.updateMany({ where: { booking_priority_id: id }, data: { booking_priority_id: replacementId } }),
      this.prisma.property.updateMany({ where: { agoda_priority_id: id }, data: { agoda_priority_id: replacementId } }),
      this.prisma.priority.delete({ where: { id } })
    ])

    return { message: 'Priority deleted successfully' }
  }
}
