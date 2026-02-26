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
}
