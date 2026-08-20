import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
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
  BulkTransferPropertyDto,
  BulkUpdateResultDto,
  CreatePropertyDto,
  AgodaCheckPropertiesDto,
  BookingCheckPropertiesDto,
  ExpediaCheckPropertiesDto,
  ExportPropertyExcelDto,
  GetPropertyCredentialDto,
  GlobalFilterIdNameDto,
  GlobalFilterSubportfolioDto,
  PROPERTY_FILTER_OPERATION_DESCRIPTION,
  PROPERTY_FILTER_SWAGGER_EXAMPLE_FILTERS,
  PropertyFilterDto,
  SyncBulkDeleteBodyDto,
  TransferPropertyDto,
  SyncByOtaDto,
  UpdatePropertyDto
} from './property.dto'
import type { IPropertyService } from './property.interface'
import { ServiceTokenGuard } from './guards/service-token.guard'
import { PropertyAgodaCheckerService } from './property-agoda-checker.service'
import { PropertyBookingCheckerService } from './property-booking-checker.service'
import { PropertyExpediaCheckerService } from './property-expedia-checker.service'

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
    private readonly propertyService: IPropertyService,
    private readonly expediaCheckerService: PropertyExpediaCheckerService,
    private readonly agodaCheckerService: PropertyAgodaCheckerService,
    private readonly bookingCheckerService: PropertyBookingCheckerService
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
    return this.propertyService.createAndSync(dto, user)
  }

  @Post('import')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.CREATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import properties from Excel',
    description:
      'Upload Excel file with Property Name (required), Portfolio (required, auto-creates if missing), Property Identifier (required). Optional: Property Address, Card Descriptor, Description, Portfolio Contact, Currency, Expedia/Booking/Agoda IDs/Statuses/Usernames/Passwords, Expedia/Booking/Agoda Secondary Username/Password, Need Another Domain (true/false), Booking OTP Phone, Case Management/Access/Reporting Contacts, Portfolio/Case Contact Emails, QP Username/Password/Api Key, FP Username/Password/MID, Stripe Account Email, New Domains Email, Webmail Password, Expedia/Booking/Agoda Processors (QuantumPay/Stripe/FreedomPay), Expedia/Booking/Agoda Billing Type (VCC/DB/EBS), Service Type, Frequency (REGULAR/ONE_TIME/STOP), Access Level (true/false), Expedia/Booking/Agoda Priority (REGULAR/HIGH — both require historical To; HIGH sets run_date to creation date + 1 day), Expedia/Booking/Agoda Historical From/To dates (MM/DD/YYYY or YYYY-MM-DD), DB Historical From/To, Scheduler (true/false), Duration (number). Passwords auto-encrypted. Existing property names skipped.'
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
    return this.propertyService.importFromExcelAndSync(file, user)
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
    - Booking Username / Booking Password
    - Expedia Secondary Username / Expedia Secondary Password
    - Booking Secondary Username / Booking Secondary Password

    Optional Agoda credential columns (independent — either may be given on its own; Agoda is not password-authenticated, the password is stored only):
    - Agoda Username / Agoda Password
    - Agoda Secondary Username / Agoda Secondary Password

    Note: Empty cells are ignored — existing values are preserved.
    `
  })
  @ApiBody({
    description:
      'Excel (.xlsx/.xls) or CSV file containing property update data',
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
  @ApiResponse({
    status: 400,
    description: 'Bad Request — invalid file or missing required column'
  })
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

  @Get('upload-job/current')
  @ApiOperation({
    summary: 'Get the most recent bulk import/update job started by the caller',
    description:
      'Useful to resume watching progress after a page refresh. Returns undefined if the caller has no job in the last 24 hours.'
  })
  @ApiResponse({ status: 200, description: 'Latest upload job status (or empty body if none)' })
  getCurrentUploadJob(@CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.getLatestUploadJobForUser(user.id)
  }

  @Get('upload-job/:jobId')
  @ApiOperation({
    summary: 'Poll the live status of a background bulk import / bulk-update job',
    description:
      'The import and bulk-update endpoints return instantly with a jobId. Poll this endpoint to watch per-portfolio and per-property progress across DBMS, scraper and dashboard (state: pending | processing | created | updated | skipped | failed). Job status is retained in Redis for 24 hours after completion; a fresh file upload always starts a new job.'
  })
  @ApiResponse({ status: 200, description: 'Upload job status' })
  @ApiResponse({ status: 404, description: 'Job not found (expired or unknown jobId)' })
  getUploadJob(@Param('jobId') jobId: string) {
    return this.propertyService.getUploadJobStatus(jobId)
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
    description:
      'Paginated list of properties. When masked=false with invalid credentials, returns masked data with error message in metadata.error',
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
              description:
                'Error message when credentials are invalid (e.g., "Invalid username or password")'
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
              name: 'expedia_processor_id',
              in: ['507f1f77bcf86cd799439099']
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
    summary: 'Export filtered properties to Excel and send via email (async)',
    description:
      "Queues an Excel (.xlsx) export of the filtered property list and returns 200 immediately — the file is generated in the background and emailed to the authenticated user's address. Files up to 10MB arrive as an attachment; larger ones are uploaded to S3 and the email carries a presigned download link valid for 7 days. All filters are optional — send an empty body {} to export everything. Pagination (page/limit) is ignored; all matching records are always exported. Pass `columns` as an array of column codes to include only those columns; omit, null, or [] to export all columns. Columns are additionally narrowed by the caller's role column template, so a restricted role never receives columns it cannot see in the list view. Because the work is backgrounded, outcomes that used to be returned inline (no matching records, no permitted columns, generation failure) are reported by email instead."
  })
  @ApiBody({
    type: ExportPropertyExcelDto,
    description:
      'All fields optional. Send {} to export all properties with all columns.',
    examples: {
      'Export all': {
        summary: 'No filters — export every property with all columns',
        value: {}
      },
      'Selected columns': {
        summary: 'Export only the requested columns',
        value: {
          columns: [
            'portfolio_id',
            'name',
            'property_identifier',
            'expedia_id',
            'booking_id',
            'agoda_id',
            'currency'
          ]
        }
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
        summary:
          'Every available filter field populated with representative values',
        value: {
          search: 'Hotel',
          is_active: true,
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          masked: false,
          user_name: 'admin@vnp.com',
          user_password: 'secret',
          columns: ['portfolio_id', 'name', 'expedia_id', 'booking_id'],
          filters: [
            { name: 'portfolio_id', in: ['507f1f77bcf86cd799439011'] },
            { name: 'subportfolio_id', in: ['507f1f77bcf86cd799439012'] },
            { name: 'property_id', in: ['507f1f77bcf86cd799439013'] },
            { name: 'property_identifier', in: ['VNP-001', 'VNP-002'] },
            { name: 'service_type_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'portfolio_contact', in: ['John Doe'] },
            { name: 'portfolio_contact_email', in: ['john@example.com'] },
            { name: 'primary_case_email', in: ['cases@example.com'] },
            { name: 'card_descriptor', in: ['HOTEL*NYC'] },
            { name: 'hotel_address', in: ['New York'] },
            { name: 'new_domain_email', in: ['domain@example.com'] },
            { name: 'case_management_contact', in: ['Jane Smith'] },
            { name: 'access_contact', in: ['access@example.com'] },
            { name: 'reporting_contact', in: ['report@example.com'] },
            { name: 'fp_mid', in: ['MID123'] },
            { name: 'fp_username', in: ['fpuser'] },
            { name: 'stripe_account_email', in: ['stripe@example.com'] },
            { name: 'expedia_id', in: [12345] },
            { name: 'expedia_status', in: ['ACTIVE'] },
            {
              name: 'expedia_billing_type_id',
              in: ['507f1f77bcf86cd799439099']
            },
            {
              name: 'expedia_service_type_id',
              in: ['507f1f77bcf86cd799439099']
            },
            { name: 'expedia_frequency_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'expedia_processor_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'expedia_access_level', in: ['true'] },
            { name: 'expedia_scheduler', in: ['false'] },
            { name: 'expedia_duration', in: [30, 60] },
            { name: 'expedia_from', in: ['2024-01-01'] },
            { name: 'expedia_to', in: ['2024-12-31'] },
            { name: 'booking_id', in: [67890] },
            { name: 'booking_status', in: ['ACTIVE'] },
            {
              name: 'booking_billing_type_id',
              in: ['507f1f77bcf86cd799439099']
            },
            {
              name: 'booking_service_type_id',
              in: ['507f1f77bcf86cd799439099']
            },
            { name: 'booking_frequency_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'booking_processor_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'booking_access_level', in: ['true'] },
            { name: 'booking_scheduler', in: ['false'] },
            { name: 'booking_duration', in: [30] },
            { name: 'booking_from', in: ['2024-01-01'] },
            { name: 'booking_to', in: ['2024-12-31'] },
            { name: 'agoda_id', in: [11111] },
            { name: 'agoda_status', in: ['ACTIVE'] },
            { name: 'agoda_billing_type_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'agoda_service_type_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'agoda_frequency_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'agoda_processor_id', in: ['507f1f77bcf86cd799439099'] },
            { name: 'agoda_access_level', in: ['true'] },
            { name: 'agoda_scheduler', in: ['false'] },
            { name: 'agoda_duration', in: [45] },
            { name: 'agoda_from', in: ['2024-01-01'] },
            { name: 'agoda_to', in: ['2024-12-31'] },
            { name: 'from', in: ['2023-06-01'] },
            { name: 'to', in: ['2024-06-01'] },
            { name: 'need_another_domain', in: ['true'] },
            { name: 'created_at', in: [], sort_by: 'desc' },
            { name: 'updated_at', in: [], sort_by: 'asc' }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description:
      'Export accepted. The workbook is built in the background and emailed when ready.',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Your file is processing and will be sent to email'
        }
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
      'Returns unique values from accessible portfolios and properties for group-filter / dropdown UIs. Includes OTA integration fields, contacts, statuses, processors, portfolio_id / subportfolio rows, service_type, qp_username, next_due_date, credential secondary usernames and need_another_domain (booleans as "true"/"false" strings). Subportfolios are loaded from the full accessible subportfolio list (same source as /subportfolio), not only those assigned to properties.'
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

  @Get(':id/contact')
  @Public()
  @UseGuards(ExternalJwtGuard)
  @ApiBearerAuth('external-jwt')
  @ApiOperation({ summary: 'Get contact information for a property' })
  @ApiResponse({ status: 200, description: 'Contact information returned' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing communication JWT'
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  getContact(@Param('id') id: string) {
    return this.propertyService.getContactExternal(id)
  }

  @Patch(':id/transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Transfer property to a different portfolio',
    description:
      "Moves a property to a new portfolio. Requires the caller's account password for confirmation."
  })
  @ApiResponse({
    status: 200,
    description: 'Property transferred successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid password or property already in the target portfolio'
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  transferPortfolio(
    @Param('id') id: string,
    @Body() dto: TransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.transferPortfolio(
      id,
      dto.portfolio_id,
      dto.password,
      user
    )
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update property by ID',
    description:
      'When the request changes an OTA\'s "to" date, CRS or priority, that OTA run date ' +
      '(expedia_run_date / booking_run_date / agoda_run_date) is recalculated automatically ' +
      'using the same rules as property creation. Sending the run date explicitly keeps the supplied value.'
  })
  @ApiResponse({ status: 200, description: 'Property updated' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.updateAndSync(id, dto, user)
  }

  @Patch(':id/sync')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE, true)
  @ApiOperation({
    summary: 'Update property and sync to dashboard + scraper',
    description:
      'When the request changes an OTA\'s "to" date, CRS or priority, that OTA run date ' +
      '(expedia_run_date / booking_run_date / agoda_run_date) is recalculated automatically ' +
      'using the same rules as property creation. Sending the run date explicitly keeps the supplied value.'
  })
  @ApiBody({
    type: UpdatePropertyDto,
    examples: {
      syncDelta: {
        summary: 'Rename + flip Booking status (syncs to dashboard + scraper)',
        value: {
          name: 'Grand Hotel & Spa',
          card_descriptor: 'GRAND HOTEL SPA NY',
          booking_status: 'Suspended'
        }
      }
    }
  })
  updateAndSync(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.updateAndSync(id, dto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.DELETE, true)
  @ApiOperation({
    summary: 'Delete property by ID',
    description:
      'Deletes the property from DBMS, then from the dashboard and the scraper. ' +
      'The two downstream deletes are independent — one failing never prevents ' +
      'the other. A 200 means the DBMS delete succeeded; inspect `sync` to see ' +
      'whether each platform also applied it.'
  })
  @ApiResponse({
    status: 200,
    description: 'Property deleted from DBMS — check `sync` for each platform',
    schema: {
      example: {
        message: 'Property deleted successfully',
        sync: {
          dashboard: { success: true },
          scraper: { success: false, reason: 'Property not found with parent_id: abc' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Property not found' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.propertyService.removeAndSync(id, user)
  }

  @Post('sync-bulk-delete')
  @Public()
  @UseGuards(ExternalJwtGuard)
  @HttpCode(200)
  @ApiBearerAuth('external-jwt')
  @ApiOperation({
    summary: 'Bulk delete properties from dashboard (external JWT)',
    description:
      'Deletes multiple properties by DBMS ID. Processes each item independently — ' +
      'a single failure does not abort the batch. ' +
      'Dashboard and scraper sync-delete calls are fired asynchronously per deleted property.'
  })
  @ApiBody({
    type: SyncBulkDeleteBodyDto,
    examples: {
      sample: {
        summary: 'Two items',
        value: {
          items: [
            { parent_id: 'dbms-property-id-1' },
            { parent_id: 'dbms-property-id-2' }
          ]
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Batch processed — partial success possible',
    schema: {
      example: {
        totalCount: 2,
        deletedCount: 1,
        failureCount: 1,
        errors: [
          {
            parent_id: 'dbms-property-id-2',
            error: 'Property not found with parent_id: dbms-property-id-2'
          }
        ],
        successfulDeletes: [{ parent_id: 'dbms-property-id-1' }]
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid communication JWT'
  })
  syncBulkDelete(@Body() body: SyncBulkDeleteBodyDto) {
    return this.propertyService.syncBulkDelete(body)
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

  @Post('bulk-transfer')
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.UPDATE)
  @ApiOperation({
    summary: 'Bulk transfer properties to a different portfolio',
    description:
      "Moves multiple properties to a new portfolio. Requires the caller's account password for confirmation. Properties already in the target portfolio or inaccessible ones are reported as skipped."
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk transfer completed',
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
        successCount: { type: 'number' },
        skippedCount: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid password' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  bulkTransferPortfolio(
    @Body() dto: BulkTransferPropertyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.propertyService.bulkTransferPortfolio(
      dto.ids,
      dto.portfolio_id,
      dto.password,
      user
    )
  }

  @Post('expedia-check')
  @HttpCode(200)
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Dispatch Expedia property check',
    description:
      'Groups the given properties by Expedia account (expedia_username) and pushes one check payload per group to the AWS SQS queue. ' +
      'After enqueueing, the checker Lambda is triggered asynchronously to drain the queue and process the checks in the background.'
  })
  @ApiBody({ type: ExpediaCheckPropertiesDto })
  @ApiResponse({
    status: 200,
    description: 'All account groups enqueued — processing in background',
    schema: {
      example: {
        message:
          'Expedia property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
        totalProperties: 3,
        accountGroups: 2
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 502,
    description: 'Expedia check queue is not configured'
  })
  checkExpediaProperties(@Body() dto: ExpediaCheckPropertiesDto) {
    return this.expediaCheckerService.checkProperties(dto.items)
  }

  @Post('agoda-check')
  @HttpCode(200)
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Dispatch Agoda property check',
    description:
      'Groups the given properties by Agoda account (agoda_username) and pushes one check payload per group to the AWS SQS queue. ' +
      'After enqueueing, the checker Lambda is triggered asynchronously to drain the queue and process the checks in the background.'
  })
  @ApiBody({ type: AgodaCheckPropertiesDto })
  @ApiResponse({
    status: 200,
    description: 'All account groups enqueued — processing in background',
    schema: {
      example: {
        message:
          'Agoda property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
        totalProperties: 3,
        accountGroups: 2
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 502,
    description: 'Agoda check queue is not configured'
  })
  checkAgodaProperties(@Body() dto: AgodaCheckPropertiesDto) {
    return this.agodaCheckerService.checkProperties(dto.items)
  }

  @Post('booking-check')
  @HttpCode(200)
  @RequirePermission(ModuleType.PROPERTY, PermissionAction.READ)
  @ApiOperation({
    summary: 'Dispatch Booking.com property check',
    description:
      'Groups the given properties by Booking account (booking_username) and pushes one check payload per group to the AWS SQS queue. ' +
      'After enqueueing, the checker Lambda is triggered asynchronously to drain the queue and process the checks in the background.'
  })
  @ApiBody({ type: BookingCheckPropertiesDto })
  @ApiResponse({
    status: 200,
    description: 'All account groups enqueued — processing in background',
    schema: {
      example: {
        message:
          'Booking property check dispatched. Payloads were queued to SQS and the checker Lambda was triggered.',
        totalProperties: 3,
        accountGroups: 2
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({
    status: 502,
    description: 'Booking check queue is not configured'
  })
  checkBookingProperties(@Body() dto: BookingCheckPropertiesDto) {
    return this.bookingCheckerService.checkProperties(dto.items)
  }
}

@ApiTags('PropertySync')
@Public()
@Controller('property')
export class PropertySyncController {
  constructor(
    @Inject('IPropertyService')
    private readonly propertyService: IPropertyService,
    private readonly expediaCheckerService: PropertyExpediaCheckerService,
    private readonly agodaCheckerService: PropertyAgodaCheckerService,
    private readonly bookingCheckerService: PropertyBookingCheckerService
  ) {}
  @Patch('sync-by-ota')
  @UseGuards(ServiceTokenGuard)
  @ApiHeader({ name: 'x-service-token', description: 'Service token' })
  @ApiOperation({ summary: 'Internal: sync property from scraper by OTA id' })
  syncByOta(@Body() dto: SyncByOtaDto) {
    return this.propertyService.syncByOta(dto)
  }

  @Post('expedia-check/trigger-lambda')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Internal: re-trigger the Expedia check Lambda',
    description:
      'Called by the scraper after a property check completes so the checker Lambda drains the next queued account group. Processes the SQS queue one group at a time.'
  })
  @ApiResponse({ status: 200, description: 'Lambda trigger requested' })
  triggerExpediaCheckLambda() {
    return this.expediaCheckerService.triggerCheckLambda()
  }

  @Post('agoda-check/trigger-lambda')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Internal: re-trigger the Agoda check Lambda',
    description:
      'Called after an Agoda property check completes so the checker Lambda drains the next queued account group. Processes the SQS queue one group at a time.'
  })
  @ApiResponse({ status: 200, description: 'Lambda trigger requested' })
  triggerAgodaCheckLambda() {
    return this.agodaCheckerService.triggerCheckLambda()
  }

  @Post('booking-check/trigger-lambda')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Internal: re-trigger the Booking check Lambda',
    description:
      'Called by the scraper after a Booking.com property check completes so the checker Lambda drains the next queued account group. Processes the SQS queue one group at a time.'
  })
  @ApiResponse({ status: 200, description: 'Lambda trigger requested' })
  triggerBookingCheckLambda() {
    return this.bookingCheckerService.triggerCheckLambda()
  }
}
