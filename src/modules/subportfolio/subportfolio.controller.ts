import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateSubportfolioDto, SubportfolioQueryDto, UpdateSubportfolioDto } from './subportfolio.dto'
import type { ISubportfolioService } from './subportfolio.interface'

@ApiTags('Subportfolio')
@ApiBearerAuth('JWT-auth')
@Controller('subportfolio')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SubportfolioController {
  constructor(
    @Inject('ISubportfolioService')
    private readonly subportfolioService: ISubportfolioService
  ) {}

  @Post()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new subportfolio' })
  @ApiResponse({ status: 201, description: 'Subportfolio created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(@Body() dto: CreateSubportfolioDto, @CurrentUser() user: IUserWithPermissions) {
    return this.subportfolioService.create(dto, user)
  }

  @Get()
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all subportfolios with pagination, search, filter and sort' })
  @ApiResponse({ status: 200, description: 'Paginated list of subportfolios' })
  findAll(@ParseQuery() query: SubportfolioQueryDto, @CurrentUser() user: IUserWithPermissions) {
    return this.subportfolioService.findAll(query, user)
  }

  @Get('all')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ)
  @ApiOperation({
    summary: 'Get all subportfolios (no filter, no pagination)',
    description:
      'Returns every subportfolio accessible to the current user in a single array. Results are Redis-cached per user and invalidated on any write.'
  })
  @ApiResponse({ status: 200, description: 'Full list of subportfolios' })
  findAllCached(@CurrentUser() user: IUserWithPermissions) {
    return this.subportfolioService.findAllCached(user)
  }

  @Get('portfolio/:portfolioId')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get subportfolios by portfolio ID' })
  @ApiResponse({ status: 200, description: 'List of subportfolios for the portfolio' })
  findByPortfolioId(
    @Param('portfolioId') portfolioId: string,
    @ParseQuery() _query: Record<string, any>,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.subportfolioService.findByPortfolioId(portfolioId, user)
  }

  @Get(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.READ, true)
  @ApiOperation({ summary: 'Get subportfolio by ID' })
  @ApiResponse({ status: 200, description: 'Subportfolio found' })
  @ApiResponse({ status: 404, description: 'Subportfolio not found' })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.subportfolioService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.UPDATE, true)
  @ApiOperation({ summary: 'Update subportfolio by ID' })
  @ApiResponse({ status: 200, description: 'Subportfolio updated' })
  @ApiResponse({ status: 404, description: 'Subportfolio not found' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubportfolioDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.subportfolioService.update(id, dto, user)
  }

  @Delete(':id')
  @RequirePermission(ModuleType.PORTFOLIO, PermissionAction.DELETE, true)
  @ApiOperation({ summary: 'Delete subportfolio by ID' })
  @ApiResponse({ status: 200, description: 'Subportfolio deleted' })
  @ApiResponse({ status: 404, description: 'Subportfolio not found' })
  remove(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.subportfolioService.remove(id, user)
  }
}
