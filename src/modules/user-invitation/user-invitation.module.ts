import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EmailUtil } from '../../common/utils/email.util'
import { PrismaService } from '../prisma/prisma.service'
import { UserInvitationController } from './user-invitation.controller'
import { UserInvitationRepository } from './user-invitation.repository'
import { UserInvitationService } from './user-invitation.service'

@Module({
  imports: [ConfigModule],
  controllers: [UserInvitationController],
  providers: [
    {
      provide: 'IUserInvitationRepository',
      useClass: UserInvitationRepository
    },
    {
      provide: 'IUserInvitationService',
      useClass: UserInvitationService
    },
    PrismaService,
    EmailUtil,
    Logger
  ],
  exports: [
    {
      provide: 'IUserInvitationService',
      useClass: UserInvitationService
    }
  ]
})
export class UserInvitationModule {}

