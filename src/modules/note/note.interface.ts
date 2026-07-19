import type { Note, Prisma } from '@prisma/client'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import type {
  BulkDeleteNotesDto,
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'

export type NoteWithRelations = Prisma.NoteGetPayload<{
  include: {
    user: {
      select: {
        id: true
        email: true
        first_name: true
        last_name: true
      }
    }
    portfolio: {
      select: {
        id: true
        name: true
      }
    }
    property: {
      select: {
        id: true
        name: true
      }
    }
  }
}>

export interface INoteRepository {
  create(data: CreateNoteDto & { user_id: string }): Promise<NoteWithRelations>
  findAll(queryOptions: { where: any; orderBy: any }): Promise<NoteWithRelations[]>
  findById(id: string): Promise<NoteWithRelations | null>
  update(id: string, data: UpdateNoteDto): Promise<NoteWithRelations>
  delete(id: string): Promise<Note>
  deleteMany(whereClause: any): Promise<number>
  deleteManyByIds(ids: string[]): Promise<number>
}

export interface INoteService {
  create(data: CreateNoteDto, user: IUserWithPermissions): Promise<NoteWithRelations>
  findAll(query: NoteQueryDto, user: IUserWithPermissions): Promise<NoteWithRelations[]>
  findOne(id: string, user: IUserWithPermissions): Promise<NoteWithRelations>
  update(id: string, data: UpdateNoteDto, user: IUserWithPermissions): Promise<NoteWithRelations>
  remove(id: string, user: IUserWithPermissions): Promise<{ message: string }>
  removeAll(query: DeleteAllNotesDto, user: IUserWithPermissions): Promise<{ message: string; deletedCount: number }>
  bulkDelete(dto: BulkDeleteNotesDto, user: IUserWithPermissions): Promise<{ message: string; deletedCount: number }>
}
