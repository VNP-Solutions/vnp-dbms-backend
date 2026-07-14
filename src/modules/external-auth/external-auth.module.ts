import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import type { Configuration } from '../../config/configuration'
import { ExternalAuthController } from './external-auth.controller'
import { ExternalAuthService } from './external-auth.service'
import { ExternalJwtGuard } from './guards/external-jwt.guard'
import { ExternalRawSecretGuard } from './guards/external-raw-secret.guard'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => ({
        secret: configService.get('jwt.communicationSecret', { infer: true })
      })
    })
  ],
  controllers: [ExternalAuthController],
  providers: [ExternalAuthService, ExternalJwtGuard, ExternalRawSecretGuard],
  exports: [ExternalJwtGuard, ExternalRawSecretGuard, JwtModule]
})
export class ExternalAuthModule {}
