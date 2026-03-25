import {
  Controller,
  Get,
  Inject,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger'
import { ProjectType } from '@prisma/client'
import type { Response } from 'express'
import { ExcelFileInterceptor } from '../../common/interceptors/excel-file.interceptor'
import { ParseQuery } from '../../common/decorators/parse-query.decorator'
import { RequireProjectRole } from '../../common/decorators/require-project-role.decorator'
import { ProjectRoleGuard } from '../../common/guards/project-role.guard'
import { hasProjectAccess } from '../../common/utils/project-context.util'
import { ResponseHandler } from '../../common/utils/response-handler.util'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import type { IPortfolioService } from '../portfolio/portfolio.interface'
import { ExternalPortfolioService } from './external-portfolio.service'

@ApiTags('External API - Portfolio')
@ApiBearerAuth('JWT-auth')
@Controller('external/portfolio')
@UseGuards(JwtAuthGuard, ProjectRoleGuard)
@RequireProjectRole([ProjectType.DASHBOARD, ProjectType.PARSER])
export class ExternalPortfolioController {
  private readonly logger = new Logger(ExternalPortfolioController.name)

  constructor(
    private readonly externalPortfolioService: ExternalPortfolioService,
    @Inject('IPortfolioService') private readonly portfolioService: IPortfolioService
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async findAll(
    @Req() request: Request,
    @ParseQuery() query: Record<string, any>,
    @Res() response: Response
  ) {
    const { user } = request as any
    const projectType = query.project_type as ProjectType
    const isActive = query.is_active as boolean | undefined
    const includeCredentials = query.include_credentials ?? false

    return ResponseHandler.handler(
      response,
      async () => {
        const portfolios = await this.externalPortfolioService.findAllForExternalProject(
          user,
          projectType,
          {
            project_type: projectType,
            is_active: isActive,
            include_credentials: includeCredentials
          }
        )
        return {
          statusCode: 200,
          message: 'Portfolios retrieved successfully',
          data: portfolios
        }
      },
      this.logger
    )
  }

  @Post('import')
  @ApiQuery({ name: 'project_type', enum: ProjectType, required: true, description: 'Project context (PARSER or DASHBOARD)' })
  @UseInterceptors(ExcelFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import portfolios from Excel (external PARSER/DASHBOARD)',
    description:
      'Same rules as POST /api/portfolio/import. Query: project_type=PARSER|DASHBOARD. Upload an Excel file; required column: Portfolio (or Portfolio Name). Optional: Service Type, Currency, Is Active, Is Commissionable, Commission, Contact Email, Portfolio Contact Email, Portfolio Contact Name, Portfolio Contact Phone, Sales Agent, Access Email, Access Phone, Attachment, Contract Signed.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx, .xls, .csv) containing portfolio data'
        }
      },
      required: ['file']
    }
  })
  @ApiResponse({ status: 201, description: 'Portfolios imported successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid file or missing required columns' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  // eslint-disable-next-line @typescript-eslint/require-await
  async importFromExcel(
    @Req() request: Request,
    @UploadedFile() file: Express.Multer.File,
    @Query('project_type') projectType: ProjectType,
    @Res() response: Response
  ) {
    const { user } = request as any

    if (!projectType) {
      return ResponseHandler.handler(
        response,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          return {
            statusCode: 400,
            message: 'project_type query parameter is required',
            data: null
          }
        },
        this.logger
      )
    }

    if (projectType !== ProjectType.PARSER && projectType !== ProjectType.DASHBOARD) {
      return ResponseHandler.handler(
        response,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          return {
            statusCode: 400,
            message: 'project_type must be PARSER or DASHBOARD',
            data: null
          }
        },
        this.logger
      )
    }

    if (!hasProjectAccess(user, projectType)) {
      return ResponseHandler.handler(
        response,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          return {
            statusCode: 403,
            message: 'Access denied for this project type',
            data: null
          }
        },
        this.logger
      )
    }

    if (!file) {
      return ResponseHandler.handler(
        response,
        // eslint-disable-next-line @typescript-eslint/require-await
        async () => {
          return {
            statusCode: 400,
            message: 'Excel file is required',
            data: null
          }
        },
        this.logger
      )
    }

    return ResponseHandler.handler(
      response,
      async () => {
        const result = await this.portfolioService.importFromExcel(file, user)
        return {
          statusCode: 200,
          message: `Import completed successfully: ${result.portfoliosCreated} portfolios created`,
          data: result
        }
      },
      this.logger
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
  // eslint-disable-next-line @typescript-eslint/require-await
  async findOne(
    @Req() request: Request,
    @Param('id') id: string,
    @ParseQuery() query: Record<string, any>,
    @Res() response: Response
  ) {
    const { user } = request as any
    const projectType = query.project_type as ProjectType
    const includeCredentials = query.include_credentials ?? true

    return ResponseHandler.handler(
      response,
      async () => {
        const portfolio =
          await this.externalPortfolioService.findOneForExternalProject(
            user,
            projectType,
            id,
            includeCredentials
          )

        if (!portfolio) {
          return {
            statusCode: 404,
            message: 'Portfolio not found or access denied',
            data: null
          }
        }

        return {
          statusCode: 200,
          message: 'Portfolio retrieved successfully',
          data: portfolio
        }
      },
      this.logger
    )
  }
}
