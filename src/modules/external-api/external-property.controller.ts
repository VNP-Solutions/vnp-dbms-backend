import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  Patch,
  Query,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import { RequireProjectRole } from '../../common/decorators/require-project-role.decorator'
import { ProjectRoleGuard } from '../../common/guards/project-role.guard'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import type { UpdatePropertyCredentialsExternalDto } from './external-api.dto'
import { ExternalPropertyService } from './external-property.service'

@ApiTags('External API - Property')
@ApiBearerAuth('JWT-auth')
@Controller('external/property')
@UseGuards(JwtAuthGuard, ProjectRoleGuard)
@RequireProjectRole([ProjectType.DASHBOARD, ProjectType.PARSER])
export class ExternalPropertyController {
  constructor(
    private readonly externalPropertyService: ExternalPropertyService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all properties for external projects (DASHBOARD/PARSER)',
    description: 'Returns properties accessible to the user based on their project role'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'portfolio_id', type: String, required: false })
  @ApiQuery({ name: 'subportfolio_id', type: String, required: false })
  @ApiQuery({ name: 'is_active', type: Boolean, required: false })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false, description: 'Include decrypted credentials' })
  @ApiResponse({ status: 200, description: 'List of properties with optional credentials' })
  async findAll(
    @CurrentUser() user: IUserWithProjectRole,
    @Query('project_type') projectType: ProjectType,
    @Query('portfolio_id') portfolioId?: string,
    @Query('subportfolio_id') subportfolioId?: string,
    @Query('is_active') isActive?: boolean,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = false
  ) {
    return this.externalPropertyService.findAllForExternalProject(
      user,
      projectType,
      {
        project_type: projectType,
        portfolio_ids: portfolioId ? [portfolioId] : undefined,
        subportfolio_ids: subportfolioId ? [subportfolioId] : undefined,
        is_active: isActive,
        include_credentials: includeCredentials
      }
    )
  }

  @Get('portfolio/:portfolioId')
  @ApiOperation({
    summary: 'Get properties by portfolio ID',
    description: 'Returns all properties in a specific portfolio'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false, description: 'Include decrypted credentials' })
  @ApiResponse({ status: 200, description: 'List of properties in portfolio with optional credentials' })
  async findByPortfolio(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('portfolioId') portfolioId: string,
    @Query('project_type') projectType: ProjectType,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = false
  ) {
    return this.externalPropertyService.findAllForExternalProject(
      user,
      projectType,
      {
        portfolio_ids: [portfolioId],
        include_credentials: includeCredentials
      }
    )
  }

  @Get('subportfolio/:subportfolioId')
  @ApiOperation({
    summary: 'Get properties by subportfolio ID',
    description: 'Returns all properties in a specific subportfolio'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false, description: 'Include decrypted credentials' })
  @ApiResponse({ status: 200, description: 'List of properties in subportfolio with optional credentials' })
  async findBySubportfolio(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('subportfolioId') subportfolioId: string,
    @Query('project_type') projectType: ProjectType,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = false
  ) {
    return this.externalPropertyService.findAllForExternalProject(
      user,
      projectType,
      {
        subportfolio_ids: [subportfolioId],
        include_credentials: includeCredentials
      }
    )
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get property by ID for external projects',
    description: 'Returns property details with decrypted credentials if user has access'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false, description: 'Include decrypted credentials (default: true)' })
  @ApiResponse({ status: 200, description: 'Property details with credentials' })
  @ApiResponse({ status: 404, description: 'Property not found or no access' })
  async findOne(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('id') id: string,
    @Query('project_type') projectType: ProjectType,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = true
  ) {
    const property =
      await this.externalPropertyService.findOneForExternalProject(
        user,
        projectType,
        id,
        includeCredentials
      )

    if (!property) {
      throw new NotFoundException('Property not found or access denied')
    }

    return property
  }

  @Patch(':propertyId/credentials')
  @ApiOperation({
    summary: 'Update property credentials for external projects',
    description: 'Updates OTA credentials (Expedia, Agoda, Booking.com) for a property'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        expediaUsername: { type: 'string', example: 'hotel@expedia.com' },
        expediaPassword: { type: 'string', example: 'secure-password' },
        agodaUsername: { type: 'string', example: 'hotel@agoda.com' },
        agodaPassword: { type: 'string', example: 'secure-password' },
        bookingUsername: { type: 'string', example: 'hotel@booking.com' },
        bookingPassword: { type: 'string', example: 'secure-password' },
        expediaEmailAssociated: { type: 'string', example: 'manager@hotel.com' },
        propertyContactEmail: { type: 'string', example: 'contact@hotel.com' },
        portfolioContactEmail: { type: 'string', example: 'portfolio@company.com' },
        multiplePortfolioEmails: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Credentials updated successfully' })
  @ApiResponse({ status: 404, description: 'Property not found or no access' })
  async updateCredentials(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('propertyId') propertyId: string,
    @Query('project_type') projectType: ProjectType,
    @Body() credentialsData: UpdatePropertyCredentialsExternalDto
  ) {
    return this.externalPropertyService.updateCredentialsForExternalProject(
      user,
      projectType,
      propertyId,
      credentialsData
    )
  }
}
