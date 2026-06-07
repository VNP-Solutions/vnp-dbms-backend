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
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ExcelFileInterceptor } from '../../common/interceptors/excel-file.interceptor'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  ModuleType,
  PermissionAction
} from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
  AllDataForGlobalFilterResponseDto,
  BulkDeletePropertyDto,
  BulkUpdateResultDto,
  CreatePropertyDto,
  ExportPropertyExcelDto,
  GetPropertyCredentialDto,
  GlobalFilterIdNameDto,
  GlobalFilterSubportfolioDto,
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
  GlobalFilterSubportfolioDto
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
  create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.create(dto, user)
  }

  @Post('import')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import properties from Excel',
    description:
      'Upload Excel file with Property Name (required), Portfolio (required, auto-creates if missing). Optional: Property Address, Card Descriptor, Description, Property Identifier, Portfolio Contact, Currency, Expedia/Booking/Agoda IDs/Statuses/Usernames/Passwords, Expedia/Booking/Agoda Secondary Username/Password, Need Another Domain (true/false), Booking OTP Phone, Case Management/Access/Reporting Contacts, Portfolio/Case Contact Emails, QP Username/Password/Api Key, FP Username/Password/MID, Stripe Account Email, New Domains Email, Webmail Password, Expedia/Booking/Agoda Processors (QuantumPay/Stripe/FreedomPay), Expedia/Booking/Agoda Billing Type (VCC/DB/EBS), Service Type, Frequency (REGULAR/ONE_TIME/STOP), Access Level (true/false), Expedia/Booking/Agoda From/To dates (OTA-specific), Scheduler (true/false), Duration (number). Passwords auto-encrypted. Existing property names skipped.'
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
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file or missing required columns'
  })
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

  @Post('bulk-update')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk update properties from Excel/CSV file',
    description: `
    Upload an Excel (.xlsx, .xls) or CSV file to bulk update existing properties.

    Property matching (checked in this order):
    1. Property Identifier/Property identifier/Identifier — preferred lookup key
    2. Property Name/Property name/Name — fallback when identifier is missing or not found

    Renaming:
    - Only possible when matched by Property Identifier.
    - Provide the new name in the "Property Name" column.
    - When matched by name, the Property Name column is used for lookup only and cannot be updated.

    Property Identifier assignment:
    - Only when matched by Property Name and the property has no existing identifier (null/empty).
    - If the property already has an identifier, the row is rejected with an error.
    - Property Identifier cannot be changed once set.

    Optional property columns (only updated when the cell has a value):
    - Hotel Address/Address/Property Address
    - Card Descriptor/Descriptor
    - Next Due Date/Due Date: mm/dd/yyyy or Excel date serial
    - Portfolio/Portfolio Name: links to an existing portfolio by name
    - Description/Desc
    - Service Type
    - Currency
    - Case Management Contact
    - Access Contact
    - Reporting Contact
    - Expedia Processor / Booking Processor / Agoda Processor
    - FP MID/fp_mid
    - Stripe Account Email
    - New Domains Email/new_domain_email
    - Portfolio Contact / Portfolio Contact Email
    - Is Active/Active: true/false/yes/no/1/0

    Optional credential columns (username and password must be provided together):
    - Expedia Username / Expedia Password
    - Agoda Username / Agoda Password
    - Booking Username / Booking Password
    - Expedia Secondary Username / Expedia Secondary Password
    - Booking Secondary Username / Booking Secondary Password
    - Agoda Secondary Username / Agoda Secondary Password

    Note: Empty cells are ignored — existing values are preserved.
    `
  })
  @ApiBody({
    description: 'Excel (.xlsx/.xls) or CSV file containing property update data',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' }
      },
      required: ['file']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk update completed',
    type: BulkUpdateResultDto
  })
  @ApiResponse({ status: 400, description: 'Bad Request — invalid file or missing required column' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  bulkUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: IUserWithPermissions
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required')
    }
    return this.propertyService.bulkUpdate(file, user)
  }

  @Post('filter')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary:
      'Get all properties with advanced filtering, pagination, search and multi-field sort',
    description: PROPERTY_FILTER_OPERATION_DESCRIPTION
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of properties. When masked=false with invalid credentials, returns masked data with error message in metadata.error',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' }
        },
        metadata: {
          type: 'object',
          properties: {
            totalDocuments: { type: 'number' },
            currentPage: { type: 'number' },
            totalPages: { type: 'number' },
            limit: { type: 'number' },
            error: {
              type: 'string',
              description: 'Error message when credentials are invalid (e.g., "Invalid username or password")'
            }
          }
        }
      }
    }
  })
  @ApiBody({
    type: PropertyFilterDto,
    description:
      'Filter, pagination, and search parameters with multi-field sorting. When masked=false, user_name and user_password are required for authentication to view decrypted credentials.',
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
          masked: false,
          user_name: 'user@example.com',
          user_password: 'your_password'
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
          masked: true,
          user_name: 'user@example.com',
          user_password: 'your_password'
        }
      },
      'Unmask credentials with authentication': {
        value: {
          filters: [
            {
              name: 'portfolio_id',
              in: ['507f1f77bcf86cd799439013']
            }
          ],
          page: 1,
          limit: 10,
          masked: false,
          user_name: 'user@example.com',
          user_password: 'your_password'
        }
      }
    }
  })
  findAllWithFilters(
    @Body() filterDto: PropertyFilterDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.findAllWithFilters(filterDto, user)
  }

  @Post('export-excel')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Export filtered properties to Excel and send via email',
    description:
      'Generates an Excel (.xlsx) file from the filtered property list and emails it to the authenticated user\'s email address. All filters are optional — send an empty body {} to export everything. Pagination (page/limit) is ignored; all matching records are always exported. Credentials are masked by default; set masked=false with user_name and user_password to include decrypted values.'
  })
  @ApiBody({
    type: ExportPropertyExcelDto,
    description: 'All fields optional. Send {} to export all properties.',
    examples: {
      'Export all': {
        summary: 'No filters — export every property',
        value: {}
      },
      'Active only + date range': {
        summary: 'Active properties created within a date range',
        value: {
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        }
      },
      'Keyword search': {
        summary: 'Free-text search across name, address, identifier, etc.',
        value: { search: 'Grand Hotel' }
      },
      'All filters combined': {
        summary: 'Every available filter field populated with representative values',
        value: {
          search: 'Hotel',
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          masked: false,
          user_name: 'admin@vnp.com',
          user_password: 'secret',
          filters: [
            { name: 'portfolio_id',         in: ['507f1f77bcf86cd799439011'] },
            { name: 'subportfolio_id',       in: ['507f1f77bcf86cd799439012'] },
            { name: 'property_id',           in: ['507f1f77bcf86cd799439013'] },
            { name: 'property_identifier',   in: ['VNP-001', 'VNP-002'] },
            { name: 'service_type',          in: ['VCC'] },
            { name: 'portfolio_contact',     in: ['John Doe'] },
            { name: 'portfolio_contact_email', in: ['john@example.com'] },
            { name: 'primary_case_email',    in: ['cases@example.com'] },
            { name: 'card_descriptor',       in: ['HOTEL*NYC'] },
            { name: 'hotel_address',         in: ['New York'] },
            { name: 'new_domain_email',      in: ['domain@example.com'] },
            { name: 'case_management_contact', in: ['Jane Smith'] },
            { name: 'access_contact',        in: ['access@example.com'] },
            { name: 'reporting_contact',     in: ['report@example.com'] },
            { name: 'fp_mid',                in: ['MID123'] },
            { name: 'fp_username',           in: ['fpuser'] },
            { name: 'stripe_account_email',  in: ['stripe@example.com'] },
            { name: 'expedia_id',            in: [12345] },
            { name: 'expedia_status',        in: ['ACTIVE'] },
            { name: 'expedia_billing_type',  in: ['VCC', 'DB'] },
            { name: 'expedia_service_type',  in: ['REGULAR'] },
            { name: 'expedia_frequency',     in: ['REGULAR', 'ONE_TIME'] },
            { name: 'expedia_processor',     in: ['QuantumPay'] },
            { name: 'expedia_access_level',  in: ['true'] },
            { name: 'expedia_scheduler',     in: ['false'] },
            { name: 'expedia_duration',      in: [30, 60] },
            { name: 'expedia_from',          in: ['2024-01-01'] },
            { name: 'expedia_to',            in: ['2024-12-31'] },
            { name: 'booking_id',            in: [67890] },
            { name: 'booking_status',        in: ['ACTIVE'] },
            { name: 'booking_billing_type',  in: ['EBS'] },
            { name: 'booking_service_type',  in: ['REGULAR'] },
            { name: 'booking_frequency',     in: ['REGULAR'] },
            { name: 'booking_processor',     in: ['Stripe'] },
            { name: 'booking_access_level',  in: ['true'] },
            { name: 'booking_scheduler',     in: ['false'] },
            { name: 'booking_duration',      in: [30] },
            { name: 'booking_from',          in: ['2024-01-01'] },
            { name: 'booking_to',            in: ['2024-12-31'] },
            { name: 'agoda_id',              in: [11111] },
            { name: 'agoda_status',          in: ['ACTIVE'] },
            { name: 'agoda_billing_type',    in: ['VCC'] },
            { name: 'agoda_service_type',    in: ['REGULAR'] },
            { name: 'agoda_frequency',       in: ['ONE_TIME'] },
            { name: 'agoda_processor',       in: ['FreedomPay'] },
            { name: 'agoda_access_level',    in: ['true'] },
            { name: 'agoda_scheduler',       in: ['false'] },
            { name: 'agoda_duration',        in: [45] },
            { name: 'agoda_from',            in: ['2024-01-01'] },
            { name: 'agoda_to',              in: ['2024-12-31'] },
            { name: 'from',                  in: ['2023-06-01'] },
            { name: 'to',                    in: ['2024-06-01'] },
            { name: 'need_another_domain',   in: ['true'] },
            { name: 'created_at',            in: [],  sort_by: 'desc' },
            { name: 'updated_at',            in: [],  sort_by: 'asc' }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Excel report generated and emailed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Excel report with 42 record(s) sent to user@example.com' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  exportToExcelAndEmail(
    @Body() dto: ExportPropertyExcelDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.exportToExcelAndEmail(dto, user)
  }

  @Get('all')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all properties (no filter, no pagination)',
    description:
      'Returns every property accessible to the current user in a single array. Credentials are always masked. Results are Redis-cached per user (1 hour TTL) and invalidated on any write.'
  })
  @ApiResponse({
    status: 200,
    description: 'Full list of properties (credentials masked)'
  })
  findAllCached(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.findAllCached(user)
  }

  @Post('refresh-cache')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Manually refresh Redis cache',
    description:
      'Clears all property and portfolio Redis cache keys and forces a fresh fetch from the database. Use this to ensure all users get the latest data immediately after database changes (e.g., after deleting portfolios).'
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
      'Returns unique values from accessible portfolios and properties for group-filter / dropdown UIs. Includes OTA integration fields, contacts, statuses, processors, portfolio_id / subportfolio rows, service_type, qp_username, next_due_date, credential secondary usernames and need_another_domain (booleans as "true"/"false" strings). Built from the same cached portfolio + property sources as list endpoints.'
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
  @ApiOperation({
    summary: 'Get portfolios and subportfolios for dropdown (permission-based)'
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolios and subportfolios for current user'
  })
  getDropdown(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getDropdown(user)
  }

  @Get('portfolio/:portfolioId')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get properties by portfolio ID' })
  @ApiResponse({
    status: 200,
    description: 'List of properties for the portfolio'
  })
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
  @ApiResponse({
    status: 200,
    description: 'List of properties for the subportfolio'
  })
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
    description:
      'Delete multiple properties by their IDs. Returns list of successfully deleted and skipped properties with reasons.'
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
  bulkDelete(
    @Body() dto: BulkDeletePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.bulkDelete(dto.ids, user)
  }
}
