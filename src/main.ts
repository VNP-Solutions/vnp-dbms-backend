import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ConfigService } from './config/config.service'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors()

  app.setGlobalPrefix('api', {
    exclude: ['/']
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  )

  const config = new DocumentBuilder()
    .setTitle('VNP Backend API')
    .setDescription('The VNP Backend API Documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header'
      },
      'JWT-auth'
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const configService = app.get(ConfigService)
  await app.listen(configService.app.port)

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
