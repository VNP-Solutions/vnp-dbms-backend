import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { OtpPlatform } from '@prisma/client'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateOtpStatusDto, UpdateOtpStatusDto } from './otp-status.dto'
import type { IOtpStatusService } from './otp-status.interface'

@ApiTags('OTP Status')
@Controller('otp-status')
@UseGuards(JwtAuthGuard)
export class OtpStatusController {
  constructor(
    @Inject('IOtpStatusService')
    private readonly otpStatusService: IOtpStatusService
  ) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get OTP status by platform (public)' })
  @ApiQuery({ name: 'platform', enum: OtpPlatform, required: true })
  @ApiResponse({ status: 200, description: 'OTP status retrieved successfully, or not found (data: null)' })
  async getByPlatform(@Query('platform') platform: OtpPlatform) {
    const otpStatus = await this.otpStatusService.findByPlatform(platform)
    if (!otpStatus) {
      return { message: `OTP status not found for platform: ${platform}`, data: null }
    }
    return { message: 'OTP status retrieved successfully', data: otpStatus }
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all OTP statuses' })
  @ApiResponse({ status: 200, description: 'All OTP statuses' })
  findAll() {
    return this.otpStatusService.findAll()
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create an OTP status' })
  @ApiResponse({ status: 201, description: 'OTP status created' })
  create(@Body() dto: CreateOtpStatusDto) {
    return this.otpStatusService.create(dto)
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update an OTP status by ID' })
  @ApiResponse({ status: 200, description: 'OTP status updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOtpStatusDto) {
    return this.otpStatusService.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete an OTP status by ID' })
  @ApiResponse({ status: 200, description: 'OTP status deleted' })
  remove(@Param('id') id: string) {
    return this.otpStatusService.remove(id)
  }
}
