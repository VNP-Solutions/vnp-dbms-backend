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
import { CreateServiceTypeDto, ReorderServiceTypeDto, UpdateServiceTypeDto } from './service-type.dto'
import type {
    IServiceTypeRepository,
    IServiceTypeService
} from './service-type.interface'

@Injectable()
export class ServiceTypeService implements IServiceTypeService {
  constructor(
    @Inject('IServiceTypeRepository')
    private serviceTypeRepository: IServiceTypeRepository,
    @Inject(PrismaService)
    private prisma: PrismaService
  ) {}

  async create(data: CreateServiceTypeDto, _user: IUserWithPermissions) {
    const existingServiceType = await this.serviceTypeRepository.findByType(
      data.type
    )

    if (existingServiceType) {
      throw new ConflictException('Service type with this name already exists')
    }

    return this.serviceTypeRepository.create(data)
  }

  async findAll(_user: IUserWithPermissions) {
    return this.serviceTypeRepository.findAll()
  }

  async findOne(id: string, _user: IUserWithPermissions) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    return serviceType
  }

  async update(
    id: string,
    data: UpdateServiceTypeDto,
    _user: IUserWithPermissions
  ) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    if (data.type && data.type !== serviceType.type) {
      const existingServiceType = await this.serviceTypeRepository.findByType(
        data.type
      )

      if (existingServiceType) {
        throw new ConflictException(
          'Service type with this name already exists'
        )
      }
    }

    return this.serviceTypeRepository.update(id, data)
  }

  async remove(id: string, password: string, user: IUserWithPermissions) {
    // Fetch user with password from database for verification
    const userFromDb = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true }
    })

    if (!userFromDb) {
      throw new NotFoundException('User not found')
    }

    // Verify user password
    const isPasswordValid = await EncryptionUtil.comparePassword(
      password,
      userFromDb.password
    )

    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password')
    }

    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    const portfolioCount = await this.serviceTypeRepository.countPortfolios(id)

    if (portfolioCount > 0) {
      throw new BadRequestException(
        `Cannot delete service type with ${portfolioCount} associated portfolios. Please delete or reassign the portfolios first.`
      )
    }

    await this.serviceTypeRepository.delete(id)

    return { message: 'Service type deleted successfully' }
  }

  async reorder(id: string, data: ReorderServiceTypeDto, _user: IUserWithPermissions) {
    const serviceType = await this.serviceTypeRepository.findById(id)

    if (!serviceType) {
      throw new NotFoundException('Service type not found')
    }

    const currentOrder = serviceType.order
    const newOrder = data.newOrder

    if (currentOrder === newOrder) {
      return { message: 'Service type order unchanged' }
    }

    // Get all service types sorted by order
    const allServiceTypes = await this.serviceTypeRepository.findAll()

    // Prepare updates
    const updates: Array<{ id: string; order: number }> = []

    if (newOrder > currentOrder) {
      // Moving down: shift items up between currentOrder and newOrder
      allServiceTypes.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order > currentOrder && item.order <= newOrder) {
          updates.push({ id: item.id, order: item.order - 1 })
        }
      })
    } else {
      // Moving up: shift items down between newOrder and currentOrder
      allServiceTypes.forEach(item => {
        if (item.id === id) {
          updates.push({ id: item.id, order: newOrder })
        } else if (item.order >= newOrder && item.order < currentOrder) {
          updates.push({ id: item.id, order: item.order + 1 })
        }
      })
    }

    await this.serviceTypeRepository.updateMany(updates)

    return { message: 'Service type order updated successfully' }
  }
}
