import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OtpStatusController } from './otp-status.controller'
import { OtpStatusRepository } from './otp-status.repository'
import { OtpStatusService } from './otp-status.service'

@Module({
  controllers: [OtpStatusController],
  providers: [
    { provide: 'IOtpStatusService', useClass: OtpStatusService },
    { provide: 'IOtpStatusRepository', useClass: OtpStatusRepository },
    PrismaService
  ],
  exports: [{ provide: 'IOtpStatusService', useClass: OtpStatusService }]
})
export class OtpStatusModule {}
