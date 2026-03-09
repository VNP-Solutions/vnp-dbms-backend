import {
  Controller,
  Get,
  NotFoundException,
  Param,
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
import { ExternalSubportfolioService } from './external-subportfolio.service'

@ApiTags('External API - Subportfolio')
@ApiBearerAuth('JWT-auth')
@Controller('external/subportfolio')
@UseGuards(JwtAuthGuard, ProjectRoleGuard)
@RequireProjectRole([ProjectType.DASHBOARD, ProjectType.PARSER])
export class ExternalSubportfolioController {
  constructor(
    private readonly externalSubportfolioService: ExternalSubportfolioService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all subportfolios for external projects (DASHBOARD/PARSER)',
    description: 'Returns subportfolios accessible to the user based on their project role'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiQuery({ name: 'portfolio_id', type: String, required: false })
  @ApiResponse({ status: 200, description: 'List of subportfolios' })
  async findAll(
    @CurrentUser() user: IUserWithProjectRole,
    @Query('project_type') projectType: ProjectType,
    @Query('portfolio_id') portfolioId?: string
  ) {
    return this.externalSubportfolioService.findAllForExternalProject(
      user,
      projectType,
      {
        project_type: projectType,
        portfolio_ids: portfolioId ? [portfolioId] : undefined
      }
    )
  }

  @Get('portfolio/:portfolioId')
  @ApiOperation({
    summary: 'Get subportfolios by portfolio ID',
    description: 'Returns all subportfolios in a specific portfolio'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiResponse({ status: 200, description: 'List of subportfolios in portfolio' })
  async findByPortfolio(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('portfolioId') portfolioId: string,
    @Query('project_type') projectType: ProjectType
  ) {
    return this.externalSubportfolioService.findByPortfolioForExternalProject(
      user,
      projectType,
      portfolioId
    )
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get subportfolio by ID for external projects',
    description: 'Returns subportfolio details if user has access'
  })
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true })
  @ApiResponse({ status: 200, description: 'Subportfolio details' })
  @ApiResponse({ status: 404, description: 'Subportfolio not found or no access' })
  async findOne(
    @CurrentUser() user: IUserWithProjectRole,
    @Param('id') id: string,
    @Query('project_type') projectType: ProjectType
  ) {
    const subportfolio =
      await this.externalSubportfolioService.findOneForExternalProject(
        user,
        projectType,
        id
      )

    if (!subportfolio) {
      throw new NotFoundException('Subportfolio not found or access denied')
    }

    return subportfolio
  }
}
