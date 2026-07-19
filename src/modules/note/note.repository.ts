import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateNoteDto, UpdateNoteDto } from './note.dto'
import type { INoteRepository } from './note.interface'

const NOTE_INCLUDE = {
  user: {
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true
    }
  },
  portfolio: {
    select: {
      id: true,
      name: true
    }
  },
  property: {
    select: {
      id: true,
      name: true
    }
  }
} as const

@Injectable()
export class NoteRepository implements INoteRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(data: CreateNoteDto & { user_id: string }) {
    return this.prisma.note.create({
      data,
      include: NOTE_INCLUDE
    })
  }

  async findAll(queryOptions: { where: any; orderBy: any }) {
    return this.prisma.note.findMany({
      where: queryOptions.where,
      orderBy: queryOptions.orderBy,
      include: NOTE_INCLUDE
    })
  }

  async findById(id: string) {
    return this.prisma.note.findUnique({
      where: { id },
      include: NOTE_INCLUDE
    })
  }

  async update(id: string, data: UpdateNoteDto) {
    return this.prisma.note.update({
      where: { id },
      data,
      include: NOTE_INCLUDE
    })
  }

  async delete(id: string) {
    return this.prisma.note.delete({ where: { id } })
  }

  async deleteMany(whereClause: any): Promise<number> {
    const result = await this.prisma.note.deleteMany({ where: whereClause })
    return result.count
  }

  async deleteManyByIds(ids: string[]): Promise<number> {
    const result = await this.prisma.note.deleteMany({ where: { id: { in: ids } } })
    return result.count
  }
}
