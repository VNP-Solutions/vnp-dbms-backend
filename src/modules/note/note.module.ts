import { Module } from '@nestjs/common'
import { PermissionService } from '../../common/services/permission.service'
import { PrismaService } from '../prisma/prisma.service'
import { NoteController } from './note.controller'
import { NoteRepository } from './note.repository'
import { NoteService } from './note.service'

@Module({
  controllers: [NoteController],
  providers: [
    {
      provide: 'INoteService',
      useClass: NoteService
    },
    {
      provide: 'INoteRepository',
      useClass: NoteRepository
    },
    PermissionService,
    PrismaService
  ],
  exports: ['INoteService']
})
export class NoteModule {}
