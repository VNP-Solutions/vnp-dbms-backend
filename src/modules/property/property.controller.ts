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
  PropertyFilterDto,
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
      'Upload an Excel file to import properties with all fields. Required: Property Name (or Property), Portfolio (auto-creates if doesn\'t exist with default "OTA" ServiceType). Optional: Sub Portfolio, Property Address, Card Descriptor, Currency, Expedia ID/Status, Booking ID/Status, Agoda ID/Status, Case Management Contact, Access Contact, Reporting Contact, Expedia Processor, Booking Processor, Agoda Processor, From, To, FP MID, Stripe Account Email. Credential columns: Expedia Username, Expedia Password, Agoda Username, Agoda Password, Booking Username, Booking Password, Expedia Email Associated, Property Contact Email, Portfolio Contact Email, Multiple Portfolio Emails, Case Contact Email, New Domains Email, Qp Username, Qp Password, Qp Api Key, Webmail Password.'
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
    description:
      'Use masked=true (default) for encrypted credentials. Use masked=false for decrypted credentials. Use is_active (true/false/All) for filtering active status. Supports multiple values per filter using the "in" array. Each filter item has: name (required), in (required array of values for OR condition), sort_by (optional: "asc" or "desc" for multi-field sorting). Sorting is applied in array order - first filter with sort_by is primary sort, second is secondary, etc. Available filter fields: portfolio_id, property_id, subportfolio_id, expedia_id, booking_id, agoda_id, card_descriptor, hotel_address, new_domain_email, portfolio_contact_email, primary_case_email, expedia_status, booking_status, agoda_status, case_management_contact, access_contact, reporting_contact, expedia_processor, booking_processor, agoda_processor, from, to, fp_mid, stripe_account_email, created_at, updated_at. For sort-only fields (created_at, updated_at): use in:[] with sort_by. Additional filters: start_date and end_date for created_at date range (YYYY-MM-DD format), search for text search across name, description, hotel_address.'
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
          filters: [
            {
              name: 'portfolio_id',
              sort_by: 'asc',
              in: ['507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014']
            },
            {
              name: 'property_id',
              in: ['507f1f77bcf86cd799439015']
            },
            {
              name: 'subportfolio_id',
              in: ['507f1f77bcf86cd799439016']
            },
            {
              name: 'expedia_id',
              sort_by: 'desc',
              in: ['EXP123', 'EXP456']
            },
            {
              name: 'booking_id',
              in: ['BK789', 'BK012']
            },
            {
              name: 'agoda_id',
              in: ['AG345', 'AG678']
            },
            {
              name: 'card_descriptor',
              in: ['VISA1234', 'MASTER5678']
            },
            {
              name: 'hotel_address',
              in: ['123 Main St', '456 Oak Ave']
            },
            {
              name: 'new_domain_email',
              in: ['hotel1@example.com', 'hotel2@example.com']
            },
            {
              name: 'portfolio_contact_email',
              in: ['contact1@example.com']
            },
            {
              name: 'primary_case_email',
              in: ['case@example.com']
            },
            {
              name: 'expedia_status',
              in: ['active', 'inactive']
            },
            {
              name: 'booking_status',
              in: ['confirmed']
            },
            {
              name: 'agoda_status',
              in: ['pending']
            },
            {
              name: 'case_management_contact',
              in: ['case-mgmt@hotel.com']
            },
            {
              name: 'access_contact',
              in: ['access@hotel.com']
            },
            {
              name: 'reporting_contact',
              in: ['reports@hotel.com']
            },
            {
              name: 'expedia_processor',
              in: ['John Doe', 'Jane Smith']
            },
            {
              name: 'booking_processor',
              in: ['Bob Wilson']
            },
            {
              name: 'agoda_processor',
              in: ['Alice Johnson']
            },
            {
              name: 'fp_mid',
              in: ['1234567890', '0987654321']
            },
            {
              name: 'stripe_account_email',
              in: ['stripe@hotel.com', 'payment@hotel.com']
            }
          ],
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
    description: 'Returns unique values extracted from accessible portfolios and properties for populating global filter dropdowns. Data is served from Redis cache.'
  })
  @ApiResponse({
    status: 200,
    description: 'Unique filter values for global filter',
    schema: {
      type: 'object',
      properties: {
        expedia_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Expedia IDs'
        },
        portfolio: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          description: 'Unique portfolios with id and name'
        },
        property: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          description: 'Unique properties with id and name'
        },
        booking_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Booking.com IDs'
        },
        agoda_id: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Agoda IDs'
        },
        hotel_address: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique hotel addresses'
        },
        card_descriptor: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique card descriptors'
        },
        new_domain_email: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique new domain emails'
        },
        portfolio_contact_email: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique portfolio contact emails'
        },
        case_contact_email: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique case contact emails'
        },
        case_management_contact: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique case management contacts'
        },
        access_contact: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique access contacts'
        },
        reporting_contact: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique reporting contacts'
        },
        expedia_processor: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Expedia processors'
        },
        booking_processor: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Booking processors'
        },
        agoda_processor: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Agoda processors'
        },
        fp_mid: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique FP MIDs'
        },
        stripe_account_email: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique Stripe account emails'
        },
        from: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique from dates'
        },
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Unique to dates'
        }
      }
    }
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
