import { Controller, Delete, Get, Inject, Param } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import type { IActivityLogService } from './activity-log.interface'

@ApiTags('Activity Logs')
@ApiBearerAuth('JWT-auth')
@Controller('activity-logs')
export class ActivityLogController {
  constructor(
    @Inject('IActivityLogService')
    private readonly activityLogService: IActivityLogService
  ) {}

  @Get()
  @RequirePermission(ModuleType.ACCESS_LOGS, PermissionAction.READ)
  @ApiOperation({ summary: 'Get all activity logs with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Returns paginated activity logs' })
  @ApiQuery({ name: 'page', required: false, type: 'number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiQuery({ name: 'success', required: false, type: 'boolean' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'resource', required: false })
  async getAllLogs(@ParseQuery() query: Record<string, any>) {
    const { page = 1, limit = 10, ...otherQuery } = query
    return this.activityLogService.getAllLogs(page, limit, otherQuery)
  }

  @Delete('/:id')
  @RequirePermission(ModuleType.ACCESS_LOGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete a specific activity log' })
  @ApiResponse({ status: 200, description: 'Activity log deleted successfully' })
  async deleteLog(@Param('id') id: string) {
    return this.activityLogService.deleteLog(id)
  }

  @Delete()
  @RequirePermission(ModuleType.ACCESS_LOGS, PermissionAction.DELETE)
  @ApiOperation({ summary: 'Delete all activity logs' })
  @ApiResponse({ status: 200, description: 'All activity logs deleted successfully' })
  async deleteAllLogs() {
    return this.activityLogService.deleteAllLogs()
  }
}