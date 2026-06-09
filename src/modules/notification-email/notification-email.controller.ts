import { Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { ModuleType, PermissionAction } from '../../common/interfaces/permission.interface'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import type { INotificationEmailService } from './notification-email.interface'

@ApiTags('Notification Email')
@ApiBearerAuth('JWT-auth')
@Controller('notification-email')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationEmailController {
  constructor(
    @Inject('INotificationEmailService')
    private readonly notificationEmailService: INotificationEmailService
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get the email notification setting (on/off)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the global email notification toggle',
    schema: { example: { id: '...', is_active: false, created_at: '...', updated_at: '...' } }
  })
  getSetting() {
    return this.notificationEmailService.getSetting()
  }

  @Patch('toggle')
  @RequirePermission(ModuleType.SYSTEM_SETTINGS, PermissionAction.UPDATE)
  @ApiOperation({ summary: 'Toggle email notifications on or off' })
  @ApiResponse({ status: 200, description: 'Setting toggled successfully' })
  toggle() {
    return this.notificationEmailService.toggle()
  }
}
