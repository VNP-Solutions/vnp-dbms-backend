import { Transform } from 'class-transformer'
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min
} from 'class-validator'

export enum NodeEnvironment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test'
}

export class ConfigurationSchema {
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 5000

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  APP_NAME?: string

  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.DEVELOPMENT

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET: string

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string

  @IsString()
  @IsNotEmpty()
  S3_BUCKET_NAME: string

  @IsString()
  @IsNotEmpty()
  S3_REGION: string

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY: string

  @IsString()
  @IsNotEmpty()
  S3_SECRET_KEY: string

  @IsUrl()
  @IsNotEmpty()
  S3_BUCKET_URL: string

  @IsString()
  @IsNotEmpty()
  SMTP_EMAIL: string

  @IsString()
  @IsNotEmpty()
  SMTP_PASSWORD: string

  @IsString()
  @IsNotEmpty()
  INVITATION_REDIRECT_URL?: string

  @IsOptional()
  @IsString()
  SCRAPER_BACKEND_URL?: string

  @IsOptional()
  @IsString()
  EXPEDIA_CHECKER_BASE_URL?: string

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  EXPEDIA_CHECKER_TIMEOUT_MS?: number

  @IsOptional()
  @IsString()
  REDIS_HOST?: string

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string

  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  REDIS_TTL?: number

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string

  @IsOptional()
  @IsString()
  COOKIE_ACCESS_TOKEN_NAME?: string

  @IsOptional()
  @IsString()
  COOKIE_REFRESH_TOKEN_NAME?: string

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string

  @IsOptional()
  @IsString()
  COOKIE_PATH?: string

  @IsOptional()
  @IsString()
  COOKIE_SECURE?: string

  @IsOptional()
  @IsString()
  COOKIE_SAME_SITE?: string
}
