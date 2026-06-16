import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException
} from '@nestjs/common'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { EncryptionUtil } from '../../common/utils/encryption.util'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCurrencyDto, CurrencyQueryDto, ReorderCurrencyDto, UpdateCurrencyDto } from './currency.dto'
import type {
    ICurrencyRepository,
    ICurrencyService
} from './currency.interface'

@Injectable()
export class CurrencyService implements ICurrencyService {
  constructor(
    @Inject('ICurrencyRepository')
    private currencyRepository: ICurrencyRepository,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(data: CreateCurrencyDto, _user: IUserWithPermissions) {
    const existingCurrency = await this.currencyRepository.findByCode(data.code)

    if (existingCurrency) {
      throw new ConflictException('Currency with this code already exists')
    }

    return this.currencyRepository.create(data)
  }

  private async attachCounts<T extends { id: string }>(items: T[]): Promise<(T & { count: number })[]> {
    const propertyCounts = await this.prisma.property.groupBy({
      by: ['currency_id'],
      _count: { id: true },
      where: { currency_id: { not: null } }
    })
    const countMap = new Map(propertyCounts.map(p => [p.currency_id, p._count.id]))
    return items.map(item => ({ ...item, count: countMap.get(item.id) ?? 0 }))
  }

  async findAll(query: CurrencyQueryDto, _user: IUserWithPermissions) {
    const search = query.search?.trim()
    const items = await this.currencyRepository.findAll(search || undefined)
    return this.attachCounts(items)
  }

  async findAllExcept(id: string, _user: IUserWithPermissions) {
    const currency = await this.currencyRepository.findById(id)
    if (!currency) {
      throw new NotFoundException('Currency not found')
    }
    const items = await this.currencyRepository.findAllExcept(id)
    return this.attachCounts(items)
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    return currency
  }

  async update(
    id: string,
    data: UpdateCurrencyDto,
    _user: IUserWithPermissions
  ) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    if (data.code && data.code !== currency.code) {
      const existingCurrency = await this.currencyRepository.findByCode(
        data.code
      )

      if (existingCurrency) {
        throw new ConflictException('Currency with this code already exists')
      }
    }

    return this.currencyRepository.update(id, data)
  }

  async remove(id: string, password: string, replacementId: string, user: IUserWithPermissions) {
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    if (id === replacementId) {
      throw new BadRequestException('Replacement currency must be different from the one being deleted')
    }

    const currency = await this.currencyRepository.findById(id)
    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    const replacement = await this.currencyRepository.findById(replacementId)
    if (!replacement) {
      throw new NotFoundException('Replacement currency not found')
    }

    await this.prisma.$transaction([
      this.prisma.property.updateMany({ where: { currency_id: id }, data: { currency_id: replacementId } }),
      this.prisma.currency.delete({ where: { id } })
    ])

    return { message: 'Currency deleted successfully' }
  }

  async reorder(id: string, data: ReorderCurrencyDto, _user: IUserWithPermissions) {
    const currency = await this.currencyRepository.findById(id)

    if (!currency) {
      throw new NotFoundException('Currency not found')
    }

    const currentOrder = currency.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Currency order unchanged' }
    }

    // Get all currencies sorted by order
    const allCurrencies = await this.currencyRepository.findAll()

    // Prepare updates
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      // Moving down: shift items up between currentOrder and newOrder
      allCurrencies.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order > currentOrder && item.order <= newOrder) {
          updates.push({ id: item.id, order: item.order - 1 })
        }
      })
    } else {
      // Moving up: shift items down between newOrder and currentOrder
      allCurrencies.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order >= newOrder && item.order < currentOrder) {
          updates.push({ id: item.id, order: item.order + 1 })
        }
      })
    }

    await this.currencyRepository.updateMany(updates)

    return { message: 'Currency order updated successfully' }
  }
}
