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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
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
  AllDataForGlobalFilterResponseDto,
  GlobalFilterIdNameDto,
  GlobalFilterServiceTypeDto,
  GlobalFilterSubportfolioDto,
  BulkDeletePropertyDto,
  CreatePropertyDto,
  GetPropertyCredentialDto,
  PROPERTY_FILTER_OPERATION_DESCRIPTION,
  PROPERTY_FILTER_SWAGGER_EXAMPLE_FILTERS,
  PropertyFilterDto,
  UpdatePropertyDto
} from './property.dto'
import type { IPropertyService } from './property.interface'

@ApiTags('Property')
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  AllDataForGlobalFilterResponseDto,
  GlobalFilterIdNameDto,
  GlobalFilterSubportfolioDto,
  GlobalFilterServiceTypeDto
)
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
      'Upload Excel file with Property Name (required), Portfolio (required, auto-creates if missing). Optional: Property Address, Card Descriptor, Description, Property Identifier, Portfolio Contact, Expedia/Booking/Agoda IDs/Statuses/Usernames/Passwords, Expedia/Booking/Agoda Secondary Username/Password, Need Another Domain (true/false), Booking OTP Phone, Case Management/Access/Reporting Contacts, Portfolio/Case Contact Emails, QP Username/Password/Api Key, FP Username/Password/MID, Stripe Account Email, New Domains Email, Webmail Password, Expedia/Booking/Agoda Processors (QuantumPay/Stripe/FreedomPay), Expedia/Booking/Agoda Billing Type (VCC/DB/EBS), Service Type, Frequency (REGULAR/ONE_TIME/STOP), Access Level (true/false), Expedia/Booking/Agoda From/To dates (OTA-specific), Scheduler (true/false), Duration (number). Passwords auto-encrypted. Existing property names skipped.'
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

  @Post('filter')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all properties with advanced filtering, pagination, search and multi-field sort',
    description: PROPERTY_FILTER_OPERATION_DESCRIPTION
  })
  @ApiResponse({ status: 200, description: 'Paginated list of properties' })
  @ApiBody({
    type: PropertyFilterDto,
    description: 'Filter, pagination, and search parameters with multi-field sorting',
    examples: {
      'Basic filter': {
        value: {
          filters: [
            {
              name: 'portfolio_id',
              sort_by: 'asc',
              in: ['507f1f77bcf86cd799439013']
            }
          ],
          page: 1,
          limit: 10,
          masked: true
        }
      },
      'Multiple filters with multi-field sort': {
        value: {
          filters: [
            {
              name: 'portfolio_id',
              sort_by: 'asc',
              in: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
            },
            {
              name: 'expedia_id',
              in: ['EXP123', 'EXP456']
            }
          ],
          is_active: true,
          page: 1,
          limit: 20,
          search: 'Hotel',
          masked: false
        }
      },
      'is_active All (both active and inactive)': {
        value: {
          filters: [
            {
              name: 'portfolio_id',
              in: ['507f1f77bcf86cd799439013']
            }
          ],
          is_active: 'All',
          page: 1,
          limit: 10,
          masked: true
        }
      },
      'Sort by created_at (no filter)': {
        value: {
          filters: [
            {
              name: 'created_at',
              sort_by: 'desc',
              in: []
            }
          ],
          page: 1,
          limit: 10,
          masked: true
        }
      },
      'With date range filter': {
        value: {
          filters: [],
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          page: 1,
          limit: 10,
          search: 'Hotel',
          masked: true
        }
      },
      'New contact and processor fields': {
        value: {
          filters: [
            {
              name: 'case_management_contact',
              in: ['case-mgmt@hotel.com']
            },
            {
              name: 'expedia_processor',
              in: ['John Doe']
            },
            {
              name: 'from',
              in: ['2024-01-01', '2024-02-01']
            },
            {
              name: 'to',
              in: ['2024-12-31']
            },
            {
              name: 'fp_mid',
              in: ['1234567890']
            },
            {
              name: 'stripe_account_email',
              in: ['stripe@hotel.com']
            }
          ],
          page: 1,
          limit: 10,
          masked: true
        }
      },
      'All available filters': {
        value: {
          filters: PROPERTY_FILTER_SWAGGER_EXAMPLE_FILTERS,
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          page: 1,
          limit: 10,
          search: 'Hotel',
          masked: true
        }
      }
    }
  })
  findAllWithFilters(@Body() filterDto: PropertyFilterDto, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findAllWithFilters(filterDto, user)
  }

  @Get('all')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all properties (no filter, no pagination)',
    description: 'Returns every property accessible to the current user in a single array. Credentials are always masked. Results are Redis-cached per user (1 hour TTL) and invalidated on any write.'
  })
  @ApiResponse({ status: 200, description: 'Full list of properties (credentials masked)' })
  findAllCached(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findAllCached(user)
  }

  @Post('refresh-cache')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Manually refresh Redis cache',
    description: 'Clears all property and portfolio Redis cache keys and forces a fresh fetch from the database. Use this to ensure all users get the latest data immediately after database changes (e.g., after deleting portfolios).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  refreshCache(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.refreshCache(user)
  }

  @Get('global-filter')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get unique filter values for global filter',
    description:
      'Returns unique values from accessible portfolios and properties for group-filter / dropdown UIs. Includes OTA integration fields, contacts, statuses, processors, portfolio_id / subportfolio rows, service_type and service_type_id, qp_username, next_due_date, credential secondary usernames and need_another_domain (booleans as "true"/"false" strings). Built from the same cached portfolio + property sources as list endpoints.'
  })
  @ApiResponse({
    status: 200,
    description: 'Unique values per field',
    type: AllDataForGlobalFilterResponseDto
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  getAllDataForGlobalFilter(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getAllDataForGlobalFilter(user)
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
