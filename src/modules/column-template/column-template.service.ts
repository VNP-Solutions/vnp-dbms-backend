import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { ColumnTemplate } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { PrismaService } from '../prisma/prisma.service'
import { CreateColumnTemplateDto, UpdateColumnTemplateDto } from './column-template.dto'
import type {
  AuthColumnTemplateResult,
  IColumnTemplateRepository,
  IColumnTemplateService
} from './column-template.interface'

@Injectable()
export class ColumnTemplateService implements IColumnTemplateService {
  constructor(
    @Inject('IColumnTemplateRepository')
    private readonly repo: IColumnTemplateRepository,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  create(data: CreateColumnTemplateDto): Promise<ColumnTemplate> {
    return this.repo.create(data)
  }

  findAll(): Promise<ColumnTemplate[]> {
    return this.repo.findAll()
  }

  async findOne(id: string): Promise<ColumnTemplate> {
    const item = await this.repo.findById(id)
    if (!item) throw new NotFoundException('Column template not found')
    return item
  }

  findByUserId(userId: string): Promise<ColumnTemplate[]> {
    return this.repo.findByUserId(userId)
  }

  async findByRoleId(roleId: string): Promise<ColumnTemplate | null> {
    const role = await this.prisma.userRole.findUnique({
      where: { id: roleId },
      select: { user_column_template_id: true }
    })

    if (!role?.user_column_template_id) return null

    return this.prisma.columnTemplate.findUnique({
      where: { id: role.user_column_template_id }
    })
  }

  async findByAuth(user: IUserWithPermissions): Promise<AuthColumnTemplateResult> {
    const [role, userTemplates] = await Promise.all([
      this.prisma.userRole.findUnique({
        where: { id: user.user_role_id },
        select: { user_column_template_id: true }
      }),
      this.repo.findByUserId(user.id)
    ])

    const roleTemplate = role?.user_column_template_id
      ? await this.prisma.columnTemplate.findUnique({
          where: { id: role.user_column_template_id }
        })
      : null

    return {
      main_column: roleTemplate?.column_list ?? [],
      all_columns: userTemplates
    }
  }

  async update(id: string, data: UpdateColumnTemplateDto): Promise<ColumnTemplate> {
    await this.findOne(id)
    return this.repo.update(id, data)
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id)
    await this.repo.delete(id)
    return { message: 'Column template deleted successfully' }
  }
}
