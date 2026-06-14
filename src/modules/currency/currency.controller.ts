import {
    Body,
    Controller,
    Get,
    Inject,
    Param,
    Patch,
    Post,
    UseGuards
} from '@nestjs/common'
import {
    ApiBearerAuth,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
    ModuleType,
    PermissionAction
} from '../../common/interfaces/permission.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import {
    CreateCurrencyDto,
    CurrencyQueryDto,
    DeleteCurrencyDto,
    ReorderCurrencyDto,
    UpdateCurrencyDto
} from './currency.dto'
import type { ICurrencyService } from './currency.interface'

@ApiTags('Currency')
@ApiBearerAuth('JWT-auth')
@Controller('currency')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CurrencyController {
  constructor(
    @Inject('ICurrencyService')
    private readonly currencyService: ICurrencyService
  ) {}

  @Post()
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.CREATE)
  @ApiOperation({ summary: 'Create a new currency' })
  @ApiResponse({ status: 201, description: 'Currency created successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  create(
    @Body() createCurrencyDto: CreateCurrencyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.currencyService.create(createCurrencyDto, user)
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all currencies with optional search (public)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by code, name, or symbol' })
  @ApiResponse({
    status: 200,
    description: 'List of currencies retrieved successfully'
  })
  findAll(@ParseQuery() query: CurrencyQueryDto) {
    return this.currencyService.findAll(query, null as any)
  }

  @Get('except/:id')
  @Public()
  @ApiOperation({ summary: 'Get all currencies except the specified one (public)' })
  @ApiResponse({
    status: 200,
    description: 'List of currencies excluding the specified ID'
  })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  findAllExcept(@Param('id') id: string) {
    return this.currencyService.findAllExcept(id, null as any)
  }

  @Get(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get a currency by ID' })
  @ApiResponse({ status: 200, description: 'Currency retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  findOne(@Param('id') id: string, @CurrentUser() user: IUserWithPermissions) {
    return this.currencyService.findOne(id, user)
  }

  @Patch(':id')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Update a currency' })
  @ApiResponse({ status: 200, description: 'Currency updated successfully' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  update(
    @Param('id') id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.currencyService.update(id, updateCurrencyDto, user)
  }

  @Post(':id/delete')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.DELETE)
  @ApiOperation({
    summary: 'Delete a currency (requires password verification)'
  })
  @ApiResponse({ status: 200, description: 'Currency deleted successfully' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete currency with associated properties or invalid password'
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  remove(
    @Param('id') id: string,
    @Body() deleteCurrencyDto: DeleteCurrencyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.currencyService.remove(id, deleteCurrencyDto.password, deleteCurrencyDto.replacementId, user)
  }

  @Patch(':id/reorder')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Reorder a currency' })
  @ApiResponse({
    status: 200,
    description: 'Currency order updated successfully'
  })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions'
  })
  reorder(
    @Param('id') id: string,
    @Body() reorderCurrencyDto: ReorderCurrencyDto,
    @CurrentUser() user: IUserWithPermissions
  ) {
    return this.currencyService.reorder(id, reorderCurrencyDto, user)
  }
}
