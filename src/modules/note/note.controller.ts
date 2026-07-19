import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import {
  CreateNoteDto,
  DeleteAllNotesDto,
  NoteQueryDto,
  UpdateNoteDto
} from './note.dto'
import type { INoteService } from './note.interface'

@ApiTags('Note')
@ApiBearerAuth('JWT-auth')
@Controller('note')
export class NoteController {
  constructor(
    @Inject('INoteService')
    private readonly noteService: INoteService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({ summary: 'Create a new note linked to a portfolio or property' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  @ApiResponse({ status: 400, description: 'Note must be associated with either a portfolio or property' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.create(dto, user)
  }

  @Get()
  @ApiOperation({ summary: 'Get all notes (filtered by user access, search, and entity type)' })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully' })
  findAll(@Query() query: NoteQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.findAll(query, user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a note by ID' })
  @ApiResponse({ status: 200, description: 'Note retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.findOne(id, user)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.noteService.update(id, dto, user)
  }

  @Delete()
  @ApiOperation({ summary: 'Delete all notes matching the filter criteria' })
  @ApiResponse({ status: 200, description: 'Notes deleted successfully' })
  @ApiResponse({ status: 400, description: 'At least one filter parameter is required' })
  removeAll(@Query() query: DeleteAllNotesDto, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.removeAll(query, user)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a note by ID' })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.noteService.remove(id, user)
  }
}
