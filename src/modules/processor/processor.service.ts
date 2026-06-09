import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateProcessorDto, ReorderProcessorDto, UpdateProcessorDto } from './processor.dto'
import type { IProcessorRepository, IProcessorService } from './processor.interface'

@Injectable()
export class ProcessorService implements IProcessorService {
  constructor(
    @Inject('IProcessorRepository')
    private readonly repo: IProcessorRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateProcessorDto, _user: IUserWithPermissions) {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Processor with this name already exists')
    return this.repo.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.repo.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Processor not found')
    return item
  }

  async update(id: string, data: UpdateProcessorDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Processor not found')
    if (data.name && data.name !== item.name) {
      const duplicate = await this.repo.findByName(data.name)
      if (duplicate) throw new ConflictException('Processor with this name already exists')
    }
    return this.repo.update(id, data)
  }

  async toggle(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Processor not found')
    return this.repo.update(id, { is_active: !item.is_active })
  }

  async reorder(id: string, data: ReorderProcessorDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Processor not found')

    const currentOrder = item.order
    const newOrder = data.newOrder
    if (currentOrder === newOrder) return { message: 'Processor order unchanged' }

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
    return { message: 'Processor order updated successfully' }
  }

  async remove(id: string, password: string, user: IUserWithPermissions) {
    const userFromDb = await this.prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    if (!userFromDb) throw new NotFoundException('User not found')

    const valid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!valid) throw new BadRequestException('Invalid password')

    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Processor not found')

    await this.repo.delete(id)
    return { message: 'Processor deleted successfully' }
  }
}
