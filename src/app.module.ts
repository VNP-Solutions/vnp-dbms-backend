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
import { FileUploadModule } from './modules/file-upload/file-upload.module'
import { PermissionModule } from './modules/permission/permission.module'
import { PortfolioModule } from './modules/portfolio/portfolio.module'
import { PrismaService } from './modules/prisma/prisma.service'
import { PropertyModule } from './modules/property/property.module'
import { ServiceTypeModule } from './modules/service-type/service-type.module'
import { SubportfolioModule } from './modules/subportfolio/subportfolio.module'
import { UserInvitationModule } from './modules/user-invitation/user-invitation.module'
import { UserRoleModule } from './modules/user-role/user-role.module'
import { UserModule } from './modules/user/user.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      cache: true
    }),
    PermissionModule,
    AuthModule,
    UserModule,
    UserRoleModule,
    EmailModule,
    FileUploadModule,
    UserInvitationModule,
    PortfolioModule,
    SubportfolioModule,
    PropertyModule,
    ServiceTypeModule,
    CurrencyModule
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
