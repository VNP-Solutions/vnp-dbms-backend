import { ValidationPipe } from '@nestjs/common'
import { ConfigService as NestConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { buildCorsOptions } from './config/cors.config'
import { Configuration } from './config/configuration'
import { ConfigService } from './config/config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const nestConfigService = app.get(NestConfigService<Configuration>)

  // Required behind nginx/ALB so Secure cookies and req.secure behave correctly.
  const expressApp = app.getHttpAdapter().getInstance()
  expressApp.set('trust proxy', 1)

  app.use(cookieParser())
  app.enableCors(
    buildCorsOptions({
      nodeEnv: nestConfigService.get('nodeEnv', { infer: true })!,
      origins: nestConfigService.get('cors.origins', { infer: true }) ?? []
    })
  )

  app.setGlobalPrefix('api', {
    exclude: ['/', 'auth', 'oauth2callback']
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        // Disable to prevent Boolean("false") = true issue
        enableImplicitConversion: false
      }
    })
  )

  const config = new DocumentBuilder()
    .setTitle('VNP Backend API')
    .setDescription(
      'The VNP Backend API Documentation. Authentication uses HTTP-only cookies (accessToken, refreshToken). Send credentials with cross-origin requests.'
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Legacy Bearer token support. Browser clients should rely on HTTP-only accessToken cookie instead.',
        in: 'header'
      },
      'JWT-auth'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Communication JWT',
        description: 'JWT signed with JWT_COMMUNICATION_SECRET (type: external-communication)',
        in: 'header'
      },
      'external-jwt'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Communication Secret',
        description: 'Raw JWT_COMMUNICATION_SECRET value',
        in: 'header'
      },
      'communication-secret'
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  // Add custom route for docs.json endpoint
  app.getHttpAdapter().get('/api/docs.json', (_req, res) => {
    res.json(document)
  })

  const configService = app.get(ConfigService)
  const cookies = nestConfigService.get('cookies', { infer: true })!
  await app.listen(configService.app.port)

  const corsOrigins =
    nestConfigService.get('cors.origins', { infer: true }) ?? []
  console.log(
    `Auth cookies: secure=${cookies.secure}, sameSite=${cookies.sameSite}, partitioned=${cookies.partitioned}` +
      (cookies.domain ? `, domain=${cookies.domain}` : '')
  )
  console.log(
    `CORS origins: ${corsOrigins.join(', ') || '(none — set CORS_ORIGIN)'}`
  )
  if (corsOrigins.length === 0) {
    console.warn(
      '[cookies] CORS_ORIGIN is not set — auth cookies fall back to localhost defaults (Lax, no Secure).'
    )
  }
  console.log(
    `Application is running on: http://localhost:${configService.app.port}`
  )
  console.log(
    `Swagger documentation available at: http://localhost:${configService.app.port}/api/docs`
  )
  console.log(
    `Deployment running on: ${'https://dashboard-backend.vnpmanage.online'}`
  )
  console.log(
    `Deployed docs: ${'https://dashboard-backend.vnpmanage.online/api/docs'}`
  )
}
void bootstrap()
