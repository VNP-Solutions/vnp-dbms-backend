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
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ExcelFileInterceptor } from '../../common/interceptors/excel-file.interceptor'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  BulkDeletePropertyDto,
  CreatePropertyDto,
  GetPropertyCredentialDto,
  PropertyQueryDto,
  UpdatePropertyDto
} from './property.dto'
import type { IPropertyService } from './property.interface'

@ApiTags('Property')
@ApiBearerAuth('JWT-auth')
@Controller('property')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyController {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService
  ) {}

  @Post('credential')
  @Public()
  @ApiOperation({
    summary: 'Get decrypted credential for a property',
    description:
      'Authenticate with email and password, then retrieve a specific decrypted credential for a property the user has access to. required_field: expedia | booking | agoda | webmail_password | qp_api_key | qp_password'
  })
  @ApiResponse({ status: 200, description: 'Decrypted credential returned' })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'No access to property' })
  @ApiResponse({ status: 404, description: 'Property or credential not found' })
  getPropertyCredential(@Body() dto: GetPropertyCredentialDto) {
    return this.propertyService.getPropertyCredential(dto)
  }

  @Post()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreatePropertyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.create(dto, user)
  }

  @Post('import')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import properties from Excel',
    description:
      'Upload an Excel file to import properties, portfolios, and subportfolios. Required: Property Name (or Property). Optional: Portfolio, Sub Portfolio, Address, Currency, Expedia ID/Status, Booking ID/Status, Agoda ID/Status. Credential columns: Expedia Username, Expedia Password, Agoda Username, Agoda Password, Booking Username, Booking Password, Expedia Email Associated, Property Contact Email, Portfolio Contact Email, Multiple Portfolio Emails.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls, .csv) containing property data'
        }
      },
      required: ['file']
    }
  })
  @ApiResponse({ status: 201, description: 'Properties imported successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file or missing required columns' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required')
    }
    return this.propertyService.importFromExcel(file, user)
  }

  @Get()
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all properties with pagination, search, filter and sort',
    description:
      'Use masked=true (default) for encrypted credentials. Use masked=false for decrypted credentials.'
  })
  @ApiResponse({ status: 200, description: 'Paginated list of properties' })
  findAll(@ParseQuery() query: PropertyQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findAll(query, user)
  }

  @Get('dropdown')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({ summary: 'Get portfolios and subportfolios for dropdown (permission-based)' })
  @ApiResponse({ status: 200, description: 'Portfolios and subportfolios for current user' })
  getDropdown(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getDropdown(user)
  }

  @Get('portfolio/:portfolioId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get properties by portfolio ID' })
  @ApiResponse({ status: 200, description: 'List of properties for the portfolio' })
  findByPortfolioId(
    @Param('portfolioId') portfolioId: string,
    @ParseQuery() _query: Record<string, any>,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findByPortfolioId(portfolioId, user)
  }

  @Get('subportfolio/:subportfolioId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get properties by subportfolio ID' })
  @ApiResponse({ status: 200, description: 'List of properties for the subportfolio' })
  findBySubportfolioId(
    @Param('subportfolioId') subportfolioId: string,
    @ParseQuery() _query: Record<string, any>,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findBySubportfolioId(subportfolioId, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiResponse({ status: 200, description: 'Property found' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update property by ID' })
  @ApiResponse({ status: 200, description: 'Property updated' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete property by ID' })
  @ApiResponse({ status: 200, description: 'Property deleted' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.remove(id, user)
  }

  @Post('bulk-delete')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Bulk delete properties',
    description: 'Delete multiple properties by their IDs. Returns list of successfully deleted and skipped properties with reasons.'
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete completed',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        },
        skipped: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string', nullable: true },
              reason: { type: 'string' }
            }
          }
        },
        totalProcessed: { type: 'number' },
        successCount: { type: 'number' },
        skippedCount: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  bulkDelete(@Body() dto: BulkDeletePropertyDto, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.bulkDelete(dto.ids, user)
  }
}
