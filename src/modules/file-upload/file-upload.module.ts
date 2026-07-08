import { Module } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import { FileUploadController } from './file-upload.controller'
import { FileUploadService } from './file-upload.service'
import { PermissionService } from '../../common/services/permission.service'
import { PortfolioRepository } from '../portfolio/portfolio.repository'
import { PrismaService } from '../prisma/prisma.service'
import { FileRepository } from './file-upload.repository'

@Module({
  controllers: [FileUploadController],
  providers: [
    ConfigService,
    PrismaService,
    PermissionService,
    {
      provide: 'IFileUploadService',
      useClass: FileUploadService
    },
    {
      provide: 'IFileRepository',
      useClass: FileRepository
    },
    {
      provide: 'IPortfolioRepository',
      useClass: PortfolioRepository
    }
  ],
  exports: [
    {
      provide: 'IFileUploadService',
      useClass: FileUploadService
    }
  ]
})
export class FileUploadModule {}
