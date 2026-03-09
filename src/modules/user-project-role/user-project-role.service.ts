import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ProjectType } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { isUserSuperAdmin } from '../../common/utils/permission.util'
import { PrismaService } from '../prisma/prisma.service'
import type {
  IProjectRole,
  IProjectRoleRepository
} from '../project-role/project-role.interface'
import {
  AssignProjectRoleDto,
  CreateUserProjectRoleDto,
  UpdateUserProjectRoleDto
} from './user-project-role.dto'
import type {
  IUserProjectRole,
  IUserProjectRoleRepository,
  IUserProjectRoleService,
  IUserProjectRoleWithRelations
} from './user-project-role.interface'

@Injectable()
export class UserProjectRoleService implements IUserProjectRoleService {
  constructor(
    @Inject('IUserProjectRoleRepository')
    private userProjectRoleRepository: IUserProjectRoleRepository,
    @Inject('IProjectRoleRepository')
    private projectRoleRepository: IProjectRoleRepository,
    private prisma: PrismaService
  ) {}

  async create(
    data: CreateUserProjectRoleDto,
    user: IUserWithPermissions
  ): Promise<IUserProjectRole> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException('Only super admins can create project roles')
    }

    // Check if user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: data.user_id }
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    // Check if user role exists
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: data.user_role_id }
    })

    if (!userRole) {
      throw new NotFoundException('User role not found')
    }

    // Check if project role exists for this project type and base user role
    const projectRole =
      await this.projectRoleRepository.findByProjectTypeAndBaseUserRole(
        data.project_type,
        data.user_role_id
      )

    if (!projectRole) {
      throw new NotFoundException(
        `Project role for ${data.project_type} with the given user role not found`
      )
    }

    // Check if user already has a role for this project
    const existingRole = await this.userProjectRoleRepository.findByUserIdAndProject(
      data.user_id,
      data.project_type
    )

    if (existingRole) {
      throw new ConflictException(
        `User already has a role assigned for ${data.project_type}`
      )
    }

    return this.userProjectRoleRepository.create({
      user_id: data.user_id,
      project_role_id: projectRole.id,
      project_type: data.project_type,
      user_role_id: data.user_role_id,
      portfolio_ids: data.portfolio_ids || [],
      subportfolio_ids: data.subportfolio_ids || [],
      property_ids: data.property_ids || [],
      is_active: data.is_active ?? true
    })
  }

  async findAll(
    user: IUserWithPermissions
  ): Promise<IUserProjectRoleWithRelations[]> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can view all project roles'
      )
    }

    return this.userProjectRoleRepository.findAll()
  }

  async findByUser(
    userId: string,
    user: IUserWithPermissions
  ): Promise<IUserProjectRoleWithRelations[]> {
    // Users can view their own project roles
    if (user.id !== userId && !isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'You can only view your own project roles'
      )
    }

    return this.userProjectRoleRepository.findByUserId(userId)
  }

  async findByUserAndProject(
    userId: string,
    projectType: ProjectType,
    user: IUserWithPermissions
  ): Promise<IUserProjectRoleWithRelations | null> {
    // Users can view their own project roles
    if (user.id !== userId && !isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'You can only view your own project roles'
      )
    }

    return this.userProjectRoleRepository.findByUserIdAndProject(
      userId,
      projectType
    )
  }

  async update(
    id: string,
    data: UpdateUserProjectRoleDto,
    user: IUserWithPermissions
  ): Promise<IUserProjectRole> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can update project roles'
      )
    }

    const userProjectRole = await this.userProjectRoleRepository.findById(id)

    if (!userProjectRole) {
      throw new NotFoundException('User project role not found')
    }

    // If updating user_role_id, verify it exists
    if (data.user_role_id) {
      const userRole = await this.prisma.userRole.findUnique({
        where: { id: data.user_role_id }
      })

      if (!userRole) {
        throw new NotFoundException('User role not found')
      }
    }

    return this.userProjectRoleRepository.update(id, data)
  }

  async remove(
    id: string,
    user: IUserWithPermissions
  ): Promise<{ message: string }> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can remove project roles'
      )
    }

    const userProjectRole = await this.userProjectRoleRepository.findById(id)

    if (!userProjectRole) {
      throw new NotFoundException('User project role not found')
    }

    await this.userProjectRoleRepository.delete(id)

    return { message: 'User project role removed successfully' }
  }

  async assignProjectRole(
    userId: string,
    projectType: ProjectType,
    userRoleId: string,
    resources: {
      portfolio_ids?: string[]
      subportfolio_ids?: string[]
      property_ids?: string[]
    },
    user: IUserWithPermissions
  ): Promise<IUserProjectRole> {
    if (!isUserSuperAdmin(user)) {
      throw new ForbiddenException(
        'Only super admins can assign project roles'
      )
    }

    // Check if user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    // Check if user role exists
    const userRole = await this.prisma.userRole.findUnique({
      where: { id: userRoleId }
    })

    if (!userRole) {
      throw new NotFoundException('User role not found')
    }

    // Check if project role exists for this project type and base user role
    const projectRole =
      await this.projectRoleRepository.findByProjectTypeAndBaseUserRole(
        projectType,
        userRoleId
      )

    if (!projectRole) {
      throw new NotFoundException(
        `Project role for ${projectType} with the given user role not found`
      )
    }

    // Check if user already has a role for this project
    const existingRole = await this.userProjectRoleRepository.findByUserIdAndProject(
      userId,
      projectType
    )

    if (existingRole) {
      // Update existing role
      return this.userProjectRoleRepository.update(existingRole.id, {
        user_role_id: userRoleId,
        portfolio_ids: resources.portfolio_ids || [],
        subportfolio_ids: resources.subportfolio_ids || [],
        property_ids: resources.property_ids || [],
        is_active: true
      })
    }

    // Create new role assignment
    return this.userProjectRoleRepository.create({
      user_id: userId,
      project_role_id: projectRole.id,
      project_type: projectType,
      user_role_id: userRoleId,
      portfolio_ids: resources.portfolio_ids || [],
      subportfolio_ids: resources.subportfolio_ids || [],
      property_ids: resources.property_ids || [],
      is_active: true
    })
  }
}
