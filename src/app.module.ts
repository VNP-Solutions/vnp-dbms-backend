import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { PermissionGuard } from './common/guards/permission.guard'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { LoggerMiddleware } from './common/middlewares/logger.middleware'
import { ConfigService } from './config/config.service'
import configuration from './config/configuration'
import { validate } from './config/validation'
import { AuthModule } from './modules/auth/auth.module'
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard'
import { CurrencyModule } from './modules/currency/currency.module'
import { EmailModule } from './modules/email/email.module'
import { ExternalApiModule } from './modules/external-api/external-api.module'
import { ExternalAuthModule } from './modules/external-auth/external-auth.module'
import { FileUploadModule } from './modules/file-upload/file-upload.module'
import { PermissionModule } from './modules/permission/permission.module'
import { PortfolioModule } from './modules/portfolio/portfolio.module'
import { ProjectRoleModule } from './modules/project-role/project-role.module'
import { PrismaService } from './modules/prisma/prisma.service'
import { PropertyModule } from './modules/property/property.module'
import { PropertyCredentialsModule } from './modules/property-credentials/property-credentials.module'
import { ServiceTypeModule } from './modules/service-type/service-type.module'
import { SubportfolioModule } from './modules/subportfolio/subportfolio.module'
import { UserInvitationModule } from './modules/user-invitation/user-invitation.module'
import { UserProjectRoleModule } from './modules/user-project-role/user-project-role.module'
import { UserRoleModule } from './modules/user-role/user-role.module'
import { RedisModule } from './modules/redis/redis.module'
import { UserModule } from './modules/user/user.module'
import { ActivityLogModule } from './modules/activity-log/activity-log.module'
import { BillingTypeModule } from './modules/billing-type/billing-type.module'
import { FrequencyModule } from './modules/frequency/frequency.module'
import { NotificationEmailModule } from './modules/notification-email/notification-email.module'
import { PriorityModule } from './modules/priority/priority.module'
import { ProcessorModule } from './modules/processor/processor.module'
import { ScheduleModule } from '@nestjs/schedule'
import { OtaAccessNotificationModule } from './modules/ota-access-notification/ota-access-notification.module'
import { OtpStatusModule } from './modules/otp-status/otp-status.module'
import { ColumnTemplateModule } from './modules/column-template/column-template.module'
import { NoteModule } from './modules/note/note.module'
import { GoogleOAuthModule } from './modules/google-oauth/google-oauth.module'
import { IpInfoModule } from './modules/ipinfo/ipinfo.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true
    }),
    RedisModule,
    PermissionModule,
    AuthModule,
    UserModule,
    UserRoleModule,
    ProjectRoleModule,
    UserProjectRoleModule,
    EmailModule,
    FileUploadModule,
    UserInvitationModule,
    PortfolioModule,
    SubportfolioModule,
    PropertyModule,
    PropertyCredentialsModule,
    ServiceTypeModule,
    CurrencyModule,
    ExternalApiModule,
    ExternalAuthModule,
    ActivityLogModule,
    BillingTypeModule,
    PriorityModule,
    FrequencyModule,
    ProcessorModule,
    NotificationEmailModule,
    OtaAccessNotificationModule,
    OtpStatusModule,
    ColumnTemplateModule,
    NoteModule,
    GoogleOAuthModule,
    IpInfoModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ConfigService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter
    }
  ],
  exports: [ConfigService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*')
  }
}
