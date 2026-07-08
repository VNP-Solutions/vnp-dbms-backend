import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { RedisService } from '../redis/redis.service'
import { PrismaService } from '../prisma/prisma.service'
import { PortfolioController } from './portfolio.controller'
import { PortfolioRepository } from './portfolio.repository'
import { PortfolioService } from './portfolio.service'
import { FileUploadModule } from '../file-upload/file-upload.module'

@Module({
  imports: [JwtModule.register({}), FileUploadModule],
  controllers: [PortfolioController],
  providers: [
    { provide: 'IPortfolioService', useClass: PortfolioService },
    { provide: 'IPortfolioRepository', useClass: PortfolioRepository },
    SyncCommunicationService,
    PrismaService,
    RedisService
  ],
  exports: [{ provide: 'IPortfolioService', useClass: PortfolioService }]
})
export class PortfolioModule {}
