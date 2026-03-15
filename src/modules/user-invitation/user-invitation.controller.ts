import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import type { UserInvitation } from '@prisma/client'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import type { IUserWithPermissions } from '../../common/interfaces/permission.interface'
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  ResendInvitationDto,
  UpdateInvitationDto
} from './user-invitation.dto'
import type { IUserInvitationService } from './user-invitation.interface'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('User Invitations')
@Controller('invitations')
export class UserInvitationController {
  constructor(
    @Inject('IUserInvitationService')
    private readonly invitationService: IUserInvitationService
  ) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a new user invitation (requires full user management)'
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created and email sent successfully'
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permission to invite users'
  })
  async createInvitation(
    @Body() data: CreateInvitationDto,
    @CurrentUser() user: IUserWithPermissions
  ): Promise<UserInvitation> {
    const permissionLevel = user.role?.user_permission?.permission_level

    if (permissionLevel !== 'all') {
      throw new Error(
        'You do not have permission to invite users. Only users with full user management permission can invite.'
      )
    }

    return this.invitationService.createInvitation(user.id, data)
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get all invitations with pagination and filtering'
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['Pending', 'Accepted', 'Expired', 'Cancelled'],
    description: 'Filter by invitation status'
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['admin', 'partial'],
    description: 'Filter by invitation role type'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by email or inviter name'
  })
  async getAllInvitations(
    @ParseQuery() query: Record<string, any>
  ): Promise<{ data: UserInvitation[]; metadata: any }> {
    return this.invitationService.getAllInvitations(query)
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get invitation by ID' })
  @ApiResponse({
    status: 200,
    description: 'Invitation retrieved successfully'
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  async getInvitationById(
    @Param('id') id: string
  ): Promise<UserInvitation> {
    return this.invitationService.getInvitationById(id)
  }

  @Get('token/:token')
  @Public()
  @ApiOperation({
    summary:
      'Get invitation by token (public endpoint used by the invitation acceptance flow)'
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation retrieved successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async getInvitationByToken(
    @Param('token') token: string
  ): Promise<UserInvitation> {
    return this.invitationService.getInvitationByToken(token)
  }

  @Post('accept/:token')
  @Public()
  @ApiOperation({
    summary: 'Accept an invitation and create a user account'
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation accepted and user created successfully'
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiBody({ type: AcceptInvitationDto })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() data: AcceptInvitationDto
  ) {
    return this.invitationService.acceptInvitation(token, data)
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation updated successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiBody({ type: UpdateInvitationDto })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  async updateInvitation(
    @Param('id') id: string,
    @Body() data: UpdateInvitationDto
  ): Promise<UserInvitation> {
    return this.invitationService.updateInvitation(id, data)
  }

  @Post(':id/resend')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resend invitation email' })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot resend non-pending invitation'
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiBody({ type: ResendInvitationDto })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  async resendInvitation(
    @Param('id') id: string,
    @Body() data: ResendInvitationDto
  ): Promise<UserInvitation> {
    return this.invitationService.resendInvitation(id, data.message)
  }

  @Post(':id/cancel')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation cancelled successfully'
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel non-pending invitation'
  })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  async cancelInvitation(
    @Param('id') id: string
  ): Promise<UserInvitation> {
    return this.invitationService.cancelInvitation(id)
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete an invitation' })
  @ApiResponse({ status: 200, description: 'Invitation deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  @ApiParam({ name: 'id', description: 'Invitation ID' })
  async deleteInvitation(
    @Param('id') id: string
  ): Promise<UserInvitation> {
    return this.invitationService.deleteInvitation(id)
  }
}

