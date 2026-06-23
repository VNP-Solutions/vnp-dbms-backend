import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface'
import type { Configuration } from './configuration'

const DEV_LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

export interface CorsConfigInput {
  nodeEnv: Configuration['nodeEnv']
  origins: string[]
}

function isOriginAllowed(origin: string, config: CorsConfigInput): boolean {
  if (config.origins.includes(origin)) {
    return true
  }

  if (config.nodeEnv !== 'production' && DEV_LOCAL_ORIGIN.test(origin)) {
    return true
  }

  return false
}

export function buildCorsOptions(config: CorsConfigInput): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin, config)) {
        callback(null, true)
        return
      }

      callback(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
    // Omit allowedHeaders so the cors package reflects
    // Access-Control-Request-Headers from the browser preflight.
  }
}
