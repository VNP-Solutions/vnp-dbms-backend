import { Injectable } from '@nestjs/common'
import { ProjectType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  IProjectRole,
  IProjectRoleRepository,
  IProjectRoleWithRelations
} from './project-role.interface'

@Injectable()
export class ProjectRoleRepository implements IProjectRoleRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<IProjectRole> {
    return this.prisma.projectRole.create({
      data
    })
  }

  async findById(id: string): Promise<IProjectRoleWithRelations | null> {
    return this.prisma.projectRole.findUnique({
      where: { id },
      include: {
        base_user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        user_project_roles: {
          select: {
            id: true,
            user_id: true,
            user_role_id: true
          }
        }
      }
    })
  }

  async findManyByProjectType(
    projectType: ProjectType
  ): Promise<IProjectRole[]> {
    return this.prisma.projectRole.findMany({
      where: { project_type: projectType }
    })
  }

  async findByProjectTypeAndName(
    projectType: ProjectType,
    name: string
  ): Promise<IProjectRole | null> {
    return this.prisma.projectRole.findFirst({
      where: { project_type: projectType, name }
    })
  }

  async findByProjectTypeAndBaseUserRole(
    projectType: ProjectType,
    baseUserRoleId: string
  ): Promise<IProjectRole | null> {
    return this.prisma.projectRole.findFirst({
      where: {
        project_type: projectType,
        base_user_role_id: baseUserRoleId
      }
    })
  }

  async findAll(
    options?: any,
    include?: any
  ): Promise<IProjectRoleWithRelations[]> {
    return this.prisma.projectRole.findMany({
      ...options,
      include: include || {
        base_user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    })
  }

  async update(id: string, data: any): Promise<IProjectRole> {
    return this.prisma.projectRole.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.projectRole.delete({
      where: { id }
    })
  }

  async count(where?: any): Promise<number> {
    return this.prisma.projectRole.count({ where })
  }
}
