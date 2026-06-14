import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateBillingTypeDto, ReorderBillingTypeDto, UpdateBillingTypeDto } from './billing-type.dto'
import type { IBillingTypeRepository, IBillingTypeService } from './billing-type.interface'

@Injectable()
export class BillingTypeService implements IBillingTypeService {
  constructor(
    @Inject('IBillingTypeRepository')
    private readonly repo: IBillingTypeRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateBillingTypeDto, _user: IUserWithPermissions) {
    const existing = await this.repo.findByName(data.name)
    if (existing) throw new ConflictException('Billing type with this name already exists')
    return this.repo.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.repo.findAll()
  }

  async findAllExcept(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')
    return this.repo.findAllExcept(id)
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')
    return item
  }

  async update(id: string, data: UpdateBillingTypeDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')
    if (data.name && data.name !== item.name) {
      const duplicate = await this.repo.findByName(data.name)
      if (duplicate) throw new ConflictException('Billing type with this name already exists')
    }
    return this.repo.update(id, data)
  }

  async toggle(id: string, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')
    return this.repo.update(id, { is_active: !item.is_active })
  }

  async reorder(id: string, data: ReorderBillingTypeDto, _user: IUserWithPermissions) {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')

    const currentOrder = item.order
    const newOrder = data.newOrder
    if (currentOrder === newOrder) return { message: 'Billing type order unchanged' }

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
    return { message: 'Billing type order updated successfully' }
  }

  async remove(id: string, password: string, replacementId: string, user: IUserWithPermissions) {
    const userFromDb = await this.prisma.user.findUnique({ where: { id: user.id }, select: { password: true } })
    if (!userFromDb) throw new NotFoundException('User not found')

    const valid = await EncryptionUtil.comparePassword(password, userFromDb.password)
    if (!valid) throw new BadRequestException('Invalid password')

    if (id === replacementId) throw new BadRequestException('Replacement billing type must be different from the one being deleted')

    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Billing type not found')

    const replacement = await this.repo.findById(replacementId)
    if (!replacement) throw new NotFoundException('Replacement billing type not found')

    await this.prisma.$transaction(async (tx) => {
      await tx.property.updateMany({ where: { expedia_billing_type_id: id }, data: { expedia_billing_type_id: replacementId } })
      await tx.property.updateMany({ where: { booking_billing_type_id: id }, data: { booking_billing_type_id: replacementId } })
      await tx.property.updateMany({ where: { agoda_billing_type_id: id }, data: { agoda_billing_type_id: replacementId } })
      await tx.billingType.delete({ where: { id } })
    })

    return { message: 'Billing type deleted successfully' }
  }
}
