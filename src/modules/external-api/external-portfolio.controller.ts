import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  Query,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import { RequireProjectRole } from '../../common/decorators/require-project-role.decorator'
import { ProjectRoleGuard } from '../../common/guards/project-role.guard'
import type { IUserWithProjectRole } from '../../common/utils/project-context.util'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ExternalPortfolioService } from './external-portfolio.service'

@ApiTags('External API - Portfolio')
@ApiBearerAuth('JWT-auth')
@Controller('external/portfolio')
@UseGuards(JwtAuthGuard, ProjectRoleGuard)
@RequireProjectRole([ProjectType.DASHBOARD, ProjectType.PARSER])
export class ExternalPortfolioController {
  constructor(
    private readonly externalPortfolioService: ExternalPortfolioService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all portfolios for external projects (DASHBOARD/PARSER)',
    description: 'Returns portfolios accessible to the user based on their project role'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'is_active', type: Boolean, required: false })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false, description: 'Include decrypted credentials' })
  @ApiResponse({ status: 200, description: 'List of portfolios with optional credentials' })
  async findAll(
    @CurrentUser() user: IUserWithProjectRole,
    @Query('project_type') projectType: ProjectType,
    @Query('is_active') isActive?: boolean,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = false
  ) {
    return this.externalPortfolioService.findAllForExternalProject(
      user,
      projectType,
      {
        project_type: projectType,
        is_active: isActive,
        include_credentials: includeCredentials
      }
    )
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get portfolio by ID for external projects',
    description: 'Returns portfolio details with decrypted credentials if user has access'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'include_credentials', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Portfolio details with credentials' })
  @ApiResponse({ status: 404, description: 'Portfolio not found or no access' })
  async findOne(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('id') id: string,
    @Query('project_type') projectType: ProjectType,
    @Query('include_credentials', new ParseBoolPipe({ optional: true }))
    includeCredentials = true
  ) {
    const portfolio =
      await this.externalPortfolioService.findOneForExternalProject(
        user,
        projectType,
        id,
        includeCredentials
      )

    if (!portfolio) {
      throw new NotFoundException('Portfolio not found or access denied')
    }

    return portfolio
  }
}
