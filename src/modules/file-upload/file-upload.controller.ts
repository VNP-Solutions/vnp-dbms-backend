import {
  Controller,
  Inject,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  BulkFileUploadResponseDto,
  FileUploadResponseDto,
  FileQueryDto,
  UpdateFileDto,
  UploadAndCreateFileDto
} from './file-upload.dto'
import type { IFileUploadService } from './file-upload.interface'
import { Body, Delete, Get, Param, Patch } from '@nestjs/common'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@ApiTags('File Upload')
@ApiBearerAuth('JWT-auth')
@Controller('file-upload')
@UseGuards(JwtAuthGuard)
export class FileUploadController {
  constructor(
    @Inject('IFileUploadService')
    private readonly fileUploadService: IFileUploadService
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to S3' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request - No file provided' })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to upload file'
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File
  ): Promise<FileUploadResponseDto> {
    return this.fileUploadService.uploadFile(file)
  }

  @Post('bulk')
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 50 * 1024 * 1024 } // 50 MB per file
    })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload multiple files to S3 (max 20 files)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary'
          },
          description: 'Files to upload (max 20)'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: BulkFileUploadResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - No files provided'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to upload files'
  })
  async uploadBulkFiles(
    @UploadedFiles() files: Express.Multer.File[]
  ): Promise<BulkFileUploadResponseDto> {
    return this.fileUploadService.uploadBulkFiles(files)
  }
  
  @Post('file')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } })
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to S3 and create its record' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        description: { type: 'string' },
        portfolio_id: { type: 'string' }
      }
    }
  })
  createFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadAndCreateFileDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.createFile(file, dto, user)
  }

  @Get('file')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all files (paginated, search, filter, sort)' })
  findAllFiles(
    @ParseQuery() query: FileQueryDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.findAllFiles(query, user)
  }

  @Get('file/portfolio/:portfolioId')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get all files for a portfolio' })
  findFilesByPortfolio(
    @Param('portfolioId') portfolioId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.findFilesByPortfolio(portfolioId, user)
  }

  @Get('file/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get a file by ID' })
  findOneFile(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.findOneFile(id, user)
  }

  @Patch('file/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update a file' })
  updateFile(
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.updateFile(id, dto, user)
  }

  @Delete('file/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete a file' })
  removeFile(
    @Param('id') id: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.fileUploadService.removeFile(id, user)
  }
}