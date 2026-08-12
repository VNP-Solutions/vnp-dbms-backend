import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ExternalJwtGuard } from '../../common/guards/external-jwt.guard'
import { ExternalRawSecretGuard } from '../../common/guards/external-raw-secret.guard'
import { SyncCommunicationService } from '../../common/services/sync-communication.service'
import { FileUploadModule } from '../file-upload/file-upload.module'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { PortfolioController } from './portfolio.controller'
import { PortfolioRepository } from './portfolio.repository'
import { PortfolioService } from './portfolio.service'

@Module({
  imports: [JwtModule.register({}), FileUploadModule],
  controllers: [PortfolioController],
  providers: [
    { provide: 'IPortfolioService', useClass: PortfolioService },
    { provide: 'IPortfolioRepository', useClass: PortfolioRepository },
    SyncCommunicationService,
    PrismaService,
    RedisService,
    ExternalJwtGuard,
    ExternalRawSecretGuard
  ],
  exports: [{ provide: 'IPortfolioService', useClass: PortfolioService }]
})
export class PortfolioModule {}
