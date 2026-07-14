import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ExcelFileInterceptor } from '../../common/interceptors/excel-file.interceptor'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
import { Public } from '../auth/decorators/public.decorator'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioService } from './portfolio.interface'
import { UploadAndCreateFileDto } from '../file-upload/file-upload.dto'

@ApiTags('Portfolio')
@ApiBearerAuth('JWT-auth')
@Controller('portfolio')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PortfolioController {
  constructor(
    @Inject('IPortfolioService')
    private readonly portfolioService: IPortfolioService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new portfolio' })
  @ApiResponse({ status: 201, description: 'Portfolio created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreatePortfolioDto, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.createAndSync(dto, user)
  }

  @Post('import')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import portfolios from Excel',
    description:
      'Upload an Excel file to import portfolios. Required column: Portfolio (or Portfolio Name). Optional: Service Type (defaults to "OTA" if not provided; auto-creates if doesn\'t exist, case-insensitive), Currency, Is Active, Is Commissionable, Commission, Contact Email, Portfolio Contact Email, Portfolio Contact Name, Portfolio Contact Phone, Sales Agent, Access Email, Access Phone, Attachment, Contract Signed.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls, .csv) containing portfolio data'
        }
      },
      required: ['file']
    }
  })
  @ApiResponse({ status: 201, description: 'Portfolios imported successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file or missing required columns' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required')
    }
    return this.portfolioService.importFromExcel(file, user)
  }

  @Get()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all portfolios with pagination, search, filter and sort' })
  @ApiResponse({ status: 200, description: 'Paginated list of portfolios' })
  findAll(@ParseQuery() query: PortfolioQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.findAll(query, user)
  }

  @Get('all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all portfolios (no filter, no pagination)',
    description: 'Returns every portfolio accessible to the current user in a single array. Results are Redis-cached per user (5 min TTL) and invalidated on any write.'
  })
  @ApiResponse({ status: 200, description: 'Full list of portfolios' })
  findAllCached(@CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.findAllCached(user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio found' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.findOne(id, user)
  }

  @Post(':id/contract-urls')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one or more contract URL files for a portfolio (max 20, 50 MB each)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'One or more files to upload'
        },
        description: { type: 'string', description: 'Optional description applied to all files' }
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Files uploaded and contract URLs created' })
  @ApiResponse({ status: 400, description: 'No files provided' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  uploadContractUrls(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadAndCreateFileDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    if (!files || files.length === 0) throw new BadRequestException('At least one file is required')
    return this.portfolioService.uploadContractUrls(id, files, dto, user)
  }

  @Get(':id/contract-urls')
  @Public()
  @UseGuards(ExternalJwtGuard)
  @ApiBearerAuth('external-jwt')
  @ApiOperation({ summary: 'Get all contract URLs for a portfolio' })
  @ApiResponse({ status: 200, description: 'List of contract URLs' })
  @ApiResponse({ status: 401, description: 'Invalid or missing communication JWT' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  getContractUrls(@Param('id') id: string) {
    return this.portfolioService.getContractUrlsExternal(id)
  }

  @Delete(':id/contract-urls')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Bulk delete contract URL files from a portfolio' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['fileIds'],
      properties: {
        fileIds: {
          type: 'array',
          items: { type: 'string' },
          example: ['fileId1', 'fileId2']
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Bulk delete result with deleted and failed file IDs' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  bulkDeleteContractUrls(
    @Param('id') id: string,
    @Body('fileIds') fileIds: string[],
    @CurrentUser() user: IUserWithPermissions
  ) {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      throw new BadRequestException('fileIds must be a non-empty array')
    }
    return this.portfolioService.bulkDeleteContractUrls(id, fileIds, user)
  }

  @Delete(':id/contract-urls/:fileId')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Delete a single contract URL file from a portfolio' })
  @ApiResponse({ status: 200, description: 'Contract URL deleted' })
  @ApiResponse({ status: 404, description: 'Portfolio or contract URL not found' })
  deleteContractUrl(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.deleteContractUrl(id, fileId, user)
  }

  @Get(':id/contact')
  @Public()
  @UseGuards(ExternalJwtGuard)
  @ApiBearerAuth('external-jwt')
  @ApiOperation({ summary: 'Get contact information for a portfolio' })
  @ApiResponse({ status: 200, description: 'Portfolio contact information' })
  @ApiResponse({ status: 401, description: 'Invalid or missing communication JWT' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  getContact(@Param('id') id: string) {
    return this.portfolioService.getContactExternal(id)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio updated' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.portfolioService.updateAndSync(id, dto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio deleted' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.removeAndSync(id, user)
  }
}

