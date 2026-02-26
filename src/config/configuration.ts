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
  dashboardUrl:
    process.env.DASHBOARD_URL || 'https://new.dashboardvnps.com/',
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
  superAdminSecret: process.env.SUPER_ADMIN_SECRET || ''
})
