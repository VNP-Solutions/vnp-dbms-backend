const LOCAL_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

export type CookieSameSite = 'lax' | 'none' | 'strict'

export interface ResolvedCookieSettings {
  secure: boolean
  sameSite: CookieSameSite
}

/** True when CORS allows at least one non-localhost origin (cross-site browser cookies). */
export function requiresCrossOriginCookies(corsOrigins: string[]): boolean {
  return corsOrigins.some(origin => !LOCAL_ORIGIN.test(origin))
}

function parseSameSite(value: string | undefined): CookieSameSite | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'lax' || normalized === 'none' || normalized === 'strict') {
    return normalized
  }
  return undefined
}

function parseSecureFlag(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined
  }
  return value.trim().toLowerCase() === 'true'
}

/**
 * Resolves auth cookie flags for local dev vs cross-origin production frontends.
 * Browsers block cross-site Set-Cookie unless SameSite=None and Secure are set.
 */
export function resolveCookieSettings(input: {
  nodeEnv: string
  corsOrigins: string[]
  cookieSecure?: string
  cookieSameSite?: string
}): ResolvedCookieSettings {
  const crossOrigin = requiresCrossOriginCookies(input.corsOrigins)
  const isProduction = input.nodeEnv === 'production'

  let secure =
    parseSecureFlag(input.cookieSecure) ??
    (crossOrigin || isProduction)

  let sameSite =
    parseSameSite(input.cookieSameSite) ??
    (crossOrigin || isProduction ? 'none' : 'lax')

  // Cross-origin credentialed requests cannot use SameSite=Lax/Strict on Set-Cookie.
  if (crossOrigin && sameSite !== 'none') {
    sameSite = 'none'
  }

  // SameSite=None requires Secure (browser rejects otherwise).
  if (sameSite === 'none') {
    secure = true
  }

  return { secure, sameSite }
}
