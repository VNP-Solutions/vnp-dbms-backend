import { Module } from '@nestjs/common'
import { ConfigService } from '../../config/config.service'
import { FileUploadController } from './file-upload.controller'
import { FileUploadService } from './file-upload.service'

@Module({
  controllers: [FileUploadController],
  providers: [
    ConfigService,
    {
      provide: 'IFileUploadService',
      useClass: FileUploadService
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
