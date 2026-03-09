import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { ProjectType } from '@prisma/client'
import { CreateProjectRoleDto, UpdateProjectRoleDto } from './project-role.dto'
import type {
  IProjectRole,
  IProjectRoleRepository,
  IProjectRoleService,
  IProjectRoleWithRelations
} from './project-role.interface'

@Injectable()
export class ProjectRoleService implements IProjectRoleService {
  constructor(
    @Inject('IProjectRoleRepository')
    private projectRoleRepository: IProjectRoleRepository
  ) {}

  async create(data: CreateProjectRoleDto): Promise<IProjectRole> {
    const existingProjectRole =
      await this.projectRoleRepository.findByProjectTypeAndName(
        data.project_type,
        data.name
      )

    if (existingProjectRole) {
      throw new ConflictException(
        `Project role '${data.name}' for ${data.project_type} already exists`
      )
    }

    return this.projectRoleRepository.create({
      project_type: data.project_type,
      name: data.name,
      description: data.description,
      base_user_role_id: data.base_user_role_id,
      is_active: data.is_active ?? true
    })
  }

  async findAll(): Promise<IProjectRoleWithRelations[]> {
    return this.projectRoleRepository.findAll(
      {
        where: { is_active: true },
        orderBy: { project_type: 'asc' }
      },
      {
        base_user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    )
  }

  async findOne(id: string): Promise<IProjectRoleWithRelations> {
    const projectRole = await this.projectRoleRepository.findById(id)

    if (!projectRole) {
      throw new NotFoundException('Project role not found')
    }

    return projectRole
  }

  async findManyByProjectType(
    projectType: ProjectType
  ): Promise<IProjectRole[]> {
    return this.projectRoleRepository.findManyByProjectType(projectType)
  }

  async findByProjectTypeAndBaseUserRole(
    projectType: ProjectType,
    baseUserRoleId: string
  ): Promise<IProjectRole> {
    const projectRole =
      await this.projectRoleRepository.findByProjectTypeAndBaseUserRole(
        projectType,
        baseUserRoleId
      )

    if (!projectRole) {
      throw new NotFoundException(
        `Project role for ${projectType} with base role not found`
      )
    }

    return projectRole
  }

  async update(
    id: string,
    data: UpdateProjectRoleDto
  ): Promise<IProjectRole> {
    const projectRole = await this.projectRoleRepository.findById(id)

    if (!projectRole) {
      throw new NotFoundException('Project role not found')
    }

    return this.projectRoleRepository.update(id, data)
  }

  async remove(id: string): Promise<{ message: string }> {
    const projectRole = await this.projectRoleRepository.findById(id)

    if (!projectRole) {
      throw new NotFoundException('Project role not found')
    }

    const userCount = await this.projectRoleRepository.count({
      id,
      user_project_roles: {
        some: {}
      }
    })

    if (userCount > 0) {
      throw new ConflictException(
        'Cannot delete project role with assigned users'
      )
    }

    await this.projectRoleRepository.delete(id)

    return { message: 'Project role deleted successfully' }
  }
}
