import { resolveCookieDomain, resolveCookieSettings } from './cookie.config'
import { normalizeCorsOrigin } from './cors.config'
import { NodeEnvironment } from './configuration.schema'

/** Axios timeout for dashboard/scraper bulk-sync HTTP calls (per chunk). */
export const SYNC_HTTP_TIMEOUT_MS = 3 * 60 * 60 * 1000

/**
 * Axios timeout dedicated to the background upload-job pipeline (portfolio /
 * property bulk import & bulk-update sync-upsert calls). Deliberately kept
 * as its own constant — NOT derived from env/SYNC_HTTP_TIMEOUT_MS — because
 * this background job is expected to run for a long time and a single
 * sync-upsert call within it should not be aborted early.
 */
export const UPLOAD_JOB_HTTP_TIMEOUT_MS = 6 * 60 * 60 * 1000

/**
 * How many properties' worth of scraper+dashboard sync-upsert calls run
 * concurrently within the upload-job pipeline. DBMS create/update for each
 * row still happens strictly one at a time (fast, local, and avoids racing
 * on inline subportfolio-by-name creation) — only the slow, network-bound
 * scraper/dashboard calls are batched. Keep this modest: scraper and
 * dashboard each do their own per-item work (credential decrypt, currency
 * resolution, etc.) and we don't want to hammer either with a large burst.
 */
export const UPLOAD_JOB_SYNC_CHUNK_SIZE = 5

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
    communicationSecret?: string
    communicationExpiresIn: string
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
  expediaCheckerBaseUrl: string
  expediaCheckerTimeoutMs: number
  expediaCheck: {
    queueUrl: string
    lambdaFunctionName: string
    lambdaPlatform: string
  }
  agodaCheck: {
    queueUrl: string
    lambdaFunctionName: string
    lambdaPlatform: string
  }
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
  serviceToken: string
  /// This DBMS backend's own reachable base URL. Currently unused now that
  /// bulk sync uses direct polling (GET /property/upload-job/:jobId)
  /// instead of a callback URL; kept for potential future use.
  /// Separate from PUBLIC_API_URL (used for cookie-domain resolution).
  dbmsApiUrl: string
  runDateCapacity: {
    expedia: number
    booking: number
    agoda: number
    expediaDb: number
  }
  cookies: {
    accessTokenName: string
    refreshTokenName: string
    domain?: string
    path: string
    httpOnly: boolean
    secure: boolean
    sameSite: 'lax' | 'none' | 'strict'
    partitioned: boolean
    sessionAccessMaxAgeMs: number
    sessionRefreshMaxAgeMs: number
    sessionAccessExpiresIn: string
    sessionRefreshExpiresIn: string
  }
  cors: {
    origins: string[]
  }
}

export default (): Configuration => {
  const nodeEnv =
    (process.env.NODE_ENV as NodeEnvironment) || NodeEnvironment.DEVELOPMENT

  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(normalizeCorsOrigin)
    .filter(Boolean)

  const cookieSettings = resolveCookieSettings({
    nodeEnv,
    corsOrigins,
    cookieSecure: process.env.COOKIE_SECURE,
    cookieSameSite: process.env.COOKIE_SAME_SITE
  })

  const cookieDomain = resolveCookieDomain(
    process.env.COOKIE_DOMAIN,
    process.env.PUBLIC_API_URL
  )

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    app: {
      port: parseInt(process.env.PORT || '3000', 10)
    },
    appName: process.env.APP_NAME,
    nodeEnv,
    database: {
      url: process.env.DATABASE_URL!
    },
    jwt: {
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      accessSecret: process.env.JWT_ACCESS_SECRET!,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '14d',
      communicationSecret: process.env.JWT_COMMUNICATION_SECRET || undefined,
      communicationExpiresIn:
        process.env.JWT_COMMUNICATION_TOKEN_EXPIRES_IN || '1d'
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
    expediaCheckerBaseUrl: process.env.EXPEDIA_CHECKER_BASE_URL || '',
    expediaCheckerTimeoutMs: parseInt(
      process.env.EXPEDIA_CHECKER_TIMEOUT_MS || '30000',
      10
    ),
    expediaCheck: {
      queueUrl: process.env.EXPEDIA_CHECK_QUEUE_URL || '',
      lambdaFunctionName: process.env.EXPEDIA_CHECK_LAMBDA_FUNCTION_NAME || '',
      lambdaPlatform: process.env.EXPEDIA_CHECK_LAMBDA_PLATFORM || 'expedia'
    },
    agodaCheck: {
      queueUrl:
        process.env.AGODA_CHECK_QUEUE_URL ||
        process.env.EXPEDIA_CHECK_QUEUE_URL ||
        '',
      lambdaFunctionName:
        process.env.AGODA_CHECK_LAMBDA_FUNCTION_NAME ||
        process.env.EXPEDIA_CHECK_LAMBDA_FUNCTION_NAME ||
        '',
      lambdaPlatform: process.env.AGODA_CHECK_LAMBDA_PLATFORM || 'agoda'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      ttl: parseInt(process.env.REDIS_TTL || '300', 10)
    },
    dashboardBackendUrl: process.env.DASHBOARD_BACKEND_URL || '',
    dashboardServiceToken: process.env.DASHBOARD_SERVICE_TOKEN || '',
    scraperServiceToken: process.env.SCRAPER_SERVICE_TOKEN || '',
    serviceToken: process.env.SERVICE_TOKEN || '',
    dbmsApiUrl: process.env.DBMS_API_URL || '',
    runDateCapacity: {
      expedia: parseInt(process.env.EXPEDIA_CAPACITY || '5', 10),
      booking: parseInt(process.env.BOOKING_CAPACITY || '5', 10),
      agoda: parseInt(process.env.AGODA_CAPACITY || '5', 10),
      expediaDb: parseInt(process.env.EXPEDIA_DB_CAPACITY || '5', 10)
    },
    cookies: {
      accessTokenName: process.env.COOKIE_ACCESS_TOKEN_NAME || 'accessToken',
      refreshTokenName: process.env.COOKIE_REFRESH_TOKEN_NAME || 'refreshToken',
      domain: cookieDomain,
      path: process.env.COOKIE_PATH || '/',
      httpOnly: true,
      secure: cookieSettings.secure,
      sameSite: cookieSettings.sameSite,
      partitioned: cookieSettings.partitioned,

      sessionAccessMaxAgeMs: parseInt(
        process.env.COOKIE_SESSION_ACCESS_MAX_AGE_MS ||
          String(2 * 60 * 60 * 1000),
        10
      ),
      sessionRefreshMaxAgeMs: parseInt(
        process.env.COOKIE_SESSION_REFRESH_MAX_AGE_MS ||
          String(18 * 60 * 60 * 1000),
        10
      ),
      sessionAccessExpiresIn:
        process.env.COOKIE_SESSION_ACCESS_EXPIRES_IN || '7d',
      sessionRefreshExpiresIn:
        process.env.COOKIE_SESSION_REFRESH_EXPIRES_IN || '14d'
    },
    cors: {
      origins: corsOrigins
    }
  }
}
