import { NodeEnvironment } from './configuration.schema'

export interface Configuration {
  port: number
  app: {
    port: number
  }
  appName?: string
  nodeEnv: NodeEnvironment
  database: {
    url: string
  }
  jwt: {
    accessSecret: string
    refreshSecret: string
    accessExpiresIn: string
    refreshExpiresIn: string
  }
  s3: {
    bucketName: string
    region: string
    accessKey: string
    secretKey: string
    bucketUrl: string
  }
  smtp: {
    email: string
    password: string
  }
  invitationRedirectUrl?: string
  dashboardUrl?: string
  auth: {
    passwordRegex: RegExp
    otpExpiryMinutes: number
    tempPasswordExpiryDays: number
  }
  encryption: {
    secret: string
  }
  parallel: {
    workers: number
  }
  superAdminSecret: string
  scraperBackendUrl: string
  redis: {
    host: string
    port: number
    password?: string
    /** Default TTL in seconds (converted to ms when passed to cache stores) */
    ttl: number
  }
  dashboardBackendUrl: string
  dashboardServiceToken: string
  scraperServiceToken: string
  syncTimeoutMs: number
  serviceToken: string
  cookies: {
    accessTokenName: string
    refreshTokenName: string
    domain?: string
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax' | 'none' | 'strict'
    sessionAccessMaxAgeMs: number
    sessionRefreshMaxAgeMs: number
    sessionAccessExpiresIn: string
    sessionRefreshExpiresIn: string
  }
  cors: {
    origins: string[]
  }
}

export default (): Configuration => ({
  port: parseInt(process.env.PORT || '3000', 10),
  app: {
    port: parseInt(process.env.PORT || '3000', 10)
  },
  appName: process.env.APP_NAME,
  nodeEnv:
    (process.env.NODE_ENV as NodeEnvironment) || NodeEnvironment.DEVELOPMENT,
  database: {
    url: process.env.DATABASE_URL!
  },
  jwt: {
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    accessSecret: process.env.JWT_ACCESS_SECRET!,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '14d'
  },
  s3: {
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.S3_REGION!,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    bucketUrl: process.env.S3_BUCKET_URL!
  },
  smtp: {
    email: process.env.SMTP_EMAIL!,
    password: process.env.SMTP_PASSWORD!
  },
  invitationRedirectUrl: process.env.INVITATION_REDIRECT_URL,
  dashboardUrl: process.env.DASHBOARD_URL || 'https://new.dashboardvnps.com/',
  auth: {
    passwordRegex:
      /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,32}$/,
    otpExpiryMinutes: 5,
    tempPasswordExpiryDays: 5
  },
  encryption: {
    secret: process.env.JWT_ACCESS_SECRET!
  },
  parallel: {
    workers: parseInt(process.env.PARALLEL_WORKERS || '8', 10)
  },
  superAdminSecret: process.env.SUPER_ADMIN_SECRET || '',
  scraperBackendUrl: process.env.SCRAPER_BACKEND_URL || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    ttl: parseInt(process.env.REDIS_TTL || '300', 10)
  },
  dashboardBackendUrl: process.env.DASHBOARD_BACKEND_URL || '',
  dashboardServiceToken: process.env.DASHBOARD_SERVICE_TOKEN || '',
  scraperServiceToken: process.env.SCRAPER_SERVICE_TOKEN || '',
  syncTimeoutMs: parseInt(process.env.SYNC_TIMEOUT_MS || '15000', 10),
  serviceToken: process.env.SERVICE_TOKEN || '',
  cookies: {
    accessTokenName: process.env.COOKIE_ACCESS_TOKEN_NAME || 'accessToken',
    refreshTokenName: process.env.COOKIE_REFRESH_TOKEN_NAME || 'refreshToken',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: process.env.COOKIE_PATH || '/',
    httpOnly: true,
    secure:
      (process.env.COOKIE_SECURE ??
        (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
    sameSite:
      (process.env.COOKIE_SAME_SITE as 'lax' | 'none' | 'strict' | undefined) ||
      (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),

    sessionAccessMaxAgeMs: parseInt(
      process.env.COOKIE_SESSION_ACCESS_MAX_AGE_MS ||
        String(2 * 60 * 60 * 1000),
      10
    ),
    sessionRefreshMaxAgeMs: parseInt(
      process.env.COOKIE_SESSION_REFRESH_MAX_AGE_MS ||
        String(2 * 60 * 60 * 1000),
      10
    ),
    sessionAccessExpiresIn:
      process.env.COOKIE_SESSION_ACCESS_EXPIRES_IN || '2h',
    sessionRefreshExpiresIn:
      process.env.COOKIE_SESSION_REFRESH_EXPIRES_IN || '2h'
  },
  cors: {
    origins: (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  }
})
