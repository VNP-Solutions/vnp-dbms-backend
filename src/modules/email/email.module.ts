import { Module } from '@nestjs/common'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { EmailController } from './email.controller'
import { EmailService } from './email.service'

@Module({
  controllers: [EmailController],
  providers: [
    {
      provide: 'IEmailService',
      useClass: EmailService
    },
    PrismaService,
    EmailUtil
  ],
  exports: [
    {
      provide: 'IEmailService',
      useClass: EmailService
    }
  ]
})
export class EmailModule {}
