import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequireProjectRole } from '../../common/decorators/require-project-role.decorator'
import { ProjectRoleGuard } from '../../common/guards/project-role.guard'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OtaQpLookupDto, UpdatePropertyCredentialsExternalDto } from './external-api.dto'
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
    @ParseQuery() query: Record<string, any>
  ) {
    const projectType = query.project_type as ProjectType
    const portfolioId = query.portfolio_id as string | undefined
    const subportfolioId = query.subportfolio_id as string | undefined
    const isActive = query.is_active as boolean | undefined
    const includeCredentials = query.include_credentials ?? false

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
    @ParseQuery() query: Record<string, any>
  ) {
    const projectType = query.project_type as ProjectType
    const includeCredentials = query.include_credentials ?? false
    return this.externalPropertyService.findAllForExternalProject(
      user,
      projectType,
      {
        project_type: projectType,
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
    @ParseQuery() query: Record<string, any>
  ) {
    const projectType = query.project_type as ProjectType
    const includeCredentials = query.include_credentials ?? false
    return this.externalPropertyService.findAllForExternalProject(
      user,
      projectType,
      {
        project_type: projectType,
        subportfolio_ids: [subportfolioId],
        include_credentials: includeCredentials
      }
    )
  }

  @Get('lookup-by-ota')
  @ApiOperation({
    summary: 'Find property by OTA channel ID (expedia/booking/agoda)',
    description: 'Looks up a property by its OTA ID and returns it with decrypted credentials. Provide exactly one of: expedia, booking, or agoda query parameter.'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'expedia', type: String, required: false, description: 'Expedia property ID' })
  @ApiQuery({ name: 'booking', type: String, required: false, description: 'Booking.com property ID' })
  @ApiQuery({ name: 'agoda', type: String, required: false, description: 'Agoda property ID' })
  @ApiResponse({ status: 200, description: 'Property with credentials' })
  @ApiResponse({ status: 400, description: 'Must provide exactly one OTA channel ID' })
  @ApiResponse({ status: 404, description: 'Property not found or no access' })
  async findByOtaId(
    @CurrentUser() user: IUserWithProjectRole,
    @ParseQuery() query: Record<string, any>
  ) {
    const projectType = query.project_type as ProjectType
    const channels = ['expedia', 'booking', 'agoda'] as const
    const provided = channels.filter(ch => query[ch])

    if (provided.length !== 1) {
      throw new BadRequestException(
        'Provide exactly one OTA channel query parameter: expedia, booking, or agoda'
      )
    }

    const channel = provided[0]
    const otaId = query[channel] as string

    const property = await this.externalPropertyService.findByOtaIdForExternalProject(
      user,
      projectType,
      channel,
      otaId
    )

    if (!property) {
      throw new NotFoundException('Property not found or access denied')
    }

    return property
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
    @ParseQuery() query: Record<string, any>
  ) {
    const projectType = query.project_type as ProjectType
    const includeCredentials = query.include_credentials ?? true
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
  @ApiBody({ type: UpdatePropertyCredentialsExternalDto })
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

  @Post('qp-lookup')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Look up QP username by OTA property IDs',
    description:
      'Accepts up to three arrays of OTA IDs (Expedia, Booking, Agoda) and returns the matching ' +
      '`qp_username` for each. IDs that do not match any property return `null` for `qp_username`.'
  })
  @ApiBody({ type: OtaQpLookupDto })
  @ApiResponse({
    status: 200,
    description: 'Flat array of { hotel_id, qp_username } entries for all supplied OTA IDs',
    schema: {
      example: [
        { hotel_id: 12345678, qp_username: 'user@example.com' },
        { hotel_id: 99999999, qp_username: null },
        { hotel_id: 11111111, qp_username: 'other@example.com' }
      ]
    }
  })
  qpLookup(@Body() dto: OtaQpLookupDto) {
    return this.externalPropertyService.getQpUsernameByOtaIds(dto)
  }
}
