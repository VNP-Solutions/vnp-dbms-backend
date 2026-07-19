import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AccessLevel,
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { PrismaService } from '../prisma/prisma.service'
import {
  BulkDeleteNotesDto,
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteEntityType,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'
import type { INoteRepository, INoteService, NoteWithRelations } from './note.interface'

@Injectable()
export class NoteService implements INoteService {
  constructor(
    @Inject('INoteRepository')
    private readonly noteRepository: INoteRepository,
    private readonly permissionService: PermissionService,
    private readonly prisma: PrismaService
  ) {}

  async create(data: CreateNoteDto, user: IUserWithPermissions): Promise<NoteWithRelations> {
    if (!data.portfolio_id && !data.property_id) {
      throw new BadRequestException(
        'Note must be associated with either a portfolio or a property'
      )
    }

    if (data.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        PermissionAction.READ,
        data.portfolio_id
      )
    } else if (data.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        PermissionAction.READ,
        data.property_id
      )
    }

    return this.noteRepository.create({ ...data, user_id: user.id })
  }

  async findAll(query: NoteQueryDto, user: IUserWithPermissions): Promise<NoteWithRelations[]> {
    const portfolioPermission = user.role.portfolio_permission
    const propertyPermission = user.role.property_permission
    const permissionFilters: any[] = []

    if (portfolioPermission && portfolioPermission.access_level !== AccessLevel.none) {
      if (portfolioPermission.access_level === AccessLevel.all) {
        permissionFilters.push({ portfolio_id: { not: null } })
      } else {
        const ids = await this.getAccessiblePortfolioIds(user.id)
        if (ids.length > 0) {
          permissionFilters.push({ portfolio_id: { in: ids } })
        }
      }
    }

    if (propertyPermission && propertyPermission.access_level !== AccessLevel.none) {
      if (propertyPermission.access_level === AccessLevel.all) {
        permissionFilters.push({ property_id: { not: null } })
      } else {
        const ids = await this.getAccessiblePropertyIds(user.id)
        if (ids.length > 0) {
          permissionFilters.push({ property_id: { in: ids } })
        }
      }
    }

    if (permissionFilters.length === 0) {
      return []
    }

    const where: any = { OR: permissionFilters }

    if (query.portfolio_id) where.portfolio_id = query.portfolio_id
    if (query.property_id) where.property_id = query.property_id

    if (query.entity_type && query.entity_type !== NoteEntityType.ALL) {
      switch (query.entity_type) {
        case NoteEntityType.PORTFOLIO:
          where.portfolio_id = { not: null }
          break
        case NoteEntityType.PROPERTY:
          where.property_id = { not: null }
          break
      }
    }

    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    if (query.search) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { text: { contains: query.search, mode: 'insensitive' } },
            { portfolio: { name: { contains: query.search, mode: 'insensitive' } } },
            { property: { name: { contains: query.search, mode: 'insensitive' } } }
          ]
        }
      ]
    }

    const orderBy = { created_at: query.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const) }

    return this.noteRepository.findAll({ where, orderBy })
  }

  async findOne(id: string, user: IUserWithPermissions): Promise<NoteWithRelations> {
    const note = await this.noteRepository.findById(id)
    if (!note) throw new NotFoundException('Note not found')
    await this.assertNoteAccess(note, user, PermissionAction.READ)
    return note
  }

  async update(id: string, data: UpdateNoteDto, user: IUserWithPermissions): Promise<NoteWithRelations> {
    const note = await this.noteRepository.findById(id)
    if (!note) throw new NotFoundException('Note not found')
    await this.assertNoteAccess(note, user, PermissionAction.UPDATE)
    return this.noteRepository.update(id, data)
  }

  async remove(id: string, user: IUserWithPermissions): Promise<{ message: string }> {
    const note = await this.noteRepository.findById(id)
    if (!note) throw new NotFoundException('Note not found')
    await this.assertNoteAccess(note, user, PermissionAction.DELETE)
    await this.noteRepository.delete(id)
    return { message: 'Note deleted successfully' }
  }

  async removeAll(
    query: DeleteAllNotesDto,
    user: IUserWithPermissions
  ): Promise<{ message: string; deletedCount: number }> {
    if (!query.portfolio_id && !query.property_id && query.is_done === undefined) {
      throw new BadRequestException(
        'At least one filter (portfolio_id, property_id, or is_done) must be provided'
      )
    }

    const portfolioPermission = user.role.portfolio_permission
    const propertyPermission = user.role.property_permission
    const permissionFilters: any[] = []

    if (portfolioPermission && portfolioPermission.access_level !== AccessLevel.none) {
      if (portfolioPermission.access_level === AccessLevel.all) {
        permissionFilters.push({ portfolio_id: { not: null } })
      } else {
        const ids = await this.getAccessiblePortfolioIds(user.id)
        if (ids.length > 0) permissionFilters.push({ portfolio_id: { in: ids } })
      }
    }

    if (propertyPermission && propertyPermission.access_level !== AccessLevel.none) {
      if (propertyPermission.access_level === AccessLevel.all) {
        permissionFilters.push({ property_id: { not: null } })
      } else {
        const ids = await this.getAccessiblePropertyIds(user.id)
        if (ids.length > 0) permissionFilters.push({ property_id: { in: ids } })
      }
    }

    if (permissionFilters.length === 0) {
      return { message: '0 note(s) deleted successfully', deletedCount: 0 }
    }

    const where: any = { OR: permissionFilters }
    if (query.portfolio_id) where.portfolio_id = query.portfolio_id
    if (query.property_id) where.property_id = query.property_id
    if (query.is_done !== undefined && query.is_done !== '') {
      where.is_done = query.is_done === 'true'
    }

    const deletedCount = await this.noteRepository.deleteMany(where)
    return { message: `${deletedCount} note(s) deleted successfully`, deletedCount }
  }

  async bulkDelete(
    dto: BulkDeleteNotesDto,
    user: IUserWithPermissions
  ): Promise<{ message: string; deletedCount: number }> {
    const notes = await Promise.all(dto.ids.map(id => this.noteRepository.findById(id)))

    await Promise.all(
      notes.map(async (note, i) => {
        if (!note) throw new NotFoundException(`Note ${dto.ids[i]} not found`)
        await this.assertNoteAccess(note, user, PermissionAction.DELETE)
      })
    )

    const deletedCount = await this.noteRepository.deleteManyByIds(dto.ids)
    return { message: `${deletedCount} note(s) deleted successfully`, deletedCount }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async assertNoteAccess(
    note: { portfolio_id: string | null; property_id: string | null },
    user: IUserWithPermissions,
    action: PermissionAction
  ): Promise<void> {
    if (note.portfolio_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PORTFOLIO,
        action,
        note.portfolio_id
      )
    } else if (note.property_id) {
      await this.permissionService.requirePermission(
        user,
        ModuleType.PROPERTY,
        action,
        note.property_id
      )
    } else {
      throw new ForbiddenException('Note is not linked to any accessible resource')
    }
  }

  private async getAccessiblePortfolioIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId, portfolio_id: { not: null } },
      select: { portfolio_id: true }
    })
    return rows.map(r => r.portfolio_id).filter((id): id is string => id !== null)
  }

  private async getAccessiblePropertyIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.userFeatureAccessPermission.findMany({
      where: { user_id: userId, property_id: { not: null } },
      select: { property_id: true }
    })
    return rows.map(r => r.property_id).filter((id): id is string => id !== null)
  }
}
