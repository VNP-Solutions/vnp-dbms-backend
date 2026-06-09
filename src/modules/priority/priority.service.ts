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

  async findAll(_user: IUserWithPermissions) {
    return this.repo.findAll()
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

  async remove(id: string, password: string, user: IUserWithPermissions) {
    const userFromDb = await this.prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    if (!userFromDb) throw new NotFoundException('User not found')

    const valid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!valid) throw new BadRequestException('Invalid password')

    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Priority not found')

    await this.repo.delete(id)
    return { message: 'Priority deleted successfully' }
  }
}
