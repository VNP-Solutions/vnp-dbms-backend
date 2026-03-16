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
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreatePortfolioDto, PortfolioQueryDto, UpdatePortfolioDto } from './portfolio.dto'
import type { IPortfolioService } from './portfolio.interface'

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
    return this.portfolioService.create(dto, user)
  }

  @Post('import')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import portfolios from Excel',
    description:
      'Upload an Excel file to import portfolios. Required column: Portfolio (or Portfolio Name). Optional: Service Type, Currency, Is Active, Is Commissionable, Contact Email, Portfolio Contact Email, Portfolio Contact Name, Portfolio Contact Phone, Sales Agent, Access Email, Access Phone, Attachment.'
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

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio found' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.findOne(id, user)
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
    return this.portfolioService.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete portfolio by ID' })
  @ApiResponse({ status: 200, description: 'Portfolio deleted' })
  @ApiResponse({ status: 404, description: 'Portfolio not found' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.portfolioService.remove(id, user)
  }
}
