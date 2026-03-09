import { Injectable } from '@nestjs/common'
import { ProjectType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type {
  IUserProjectRole,
  IUserProjectRoleRepository,
  IUserProjectRoleWithRelations
} from './user-project-role.interface'

@Injectable()
export class UserProjectRoleRepository implements IUserProjectRoleRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: any): Promise<IUserProjectRole> {
    return this.prisma.userProjectRole.create({
      data
    })
  }

  async findById(id: string): Promise<IUserProjectRoleWithRelations | null> {
    return this.prisma.userProjectRole.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        project_role: {
          select: {
            id: true,
            name: true,
            project_type: true
          }
        }
      }
    })
  }

  async findByUserId(userId: string): Promise<IUserProjectRoleWithRelations[]> {
    return this.prisma.userProjectRole.findMany({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        project_role: {
          select: {
            id: true,
            name: true,
            project_type: true
          }
        }
      }
    })
  }

  async findByUserIdAndProject(
    userId: string,
    projectType: ProjectType
  ): Promise<IUserProjectRoleWithRelations | null> {
    return this.prisma.userProjectRole.findUnique({
      where: {
        user_id_project_type: {
          user_id: userId,
          project_type: projectType
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        project_role: {
          select: {
            id: true,
            name: true,
            project_type: true
          }
        }
      }
    })
  }

  async findAll(
    options?: any,
    include?: any
  ): Promise<IUserProjectRoleWithRelations[]> {
    return this.prisma.userProjectRole.findMany({
      ...options,
      include: include || {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true
          }
        },
        user_role: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        project_role: {
          select: {
            id: true,
            name: true,
            project_type: true
          }
        }
      }
    })
  }

  async update(id: string, data: any): Promise<IUserProjectRole> {
    return this.prisma.userProjectRole.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.userProjectRole.delete({
      where: { id }
    })
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.userProjectRole.deleteMany({
      where: { user_id: userId }
    })
  }

  async count(where?: any): Promise<number> {
    return this.prisma.userProjectRole.count({ where })
  }
}
