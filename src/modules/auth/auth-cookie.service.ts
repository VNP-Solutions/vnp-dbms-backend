import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CookieOptions, Response } from 'express'
import { jwtExpiresInToMs } from '../../common/utils/jwt-expires.util'
import { Configuration } from '../../config/configuration'
import type { AuthTokens } from './auth.interface'

export interface AuthCookieSessionOptions {
  /** When false, uses shorter session cookie lifetimes. Defaults to true. */
  keepSignIn?: boolean
}

@Injectable()
export class AuthCookieService {
  constructor(
    private readonly configService: ConfigService<Configuration>
  ) {}

  setAuthCookies(
    res: Response,
    tokens: AuthTokens,
    options: AuthCookieSessionOptions = {}
  ): void {
    const keepSignIn = options.keepSignIn !== false

    res.cookie(
      this.accessTokenCookieName(),
      tokens.accessToken,
      this.accessTokenCookieOptions(keepSignIn)
    )
    res.cookie(
      this.refreshTokenCookieName(),
      tokens.refreshToken,
      this.refreshTokenCookieOptions(keepSignIn)
    )
  }

  clearAuthCookies(res: Response): void {
    const clearOptions = this.clearCookieOptions()
    res.clearCookie(this.accessTokenCookieName(), clearOptions)
    res.clearCookie(this.refreshTokenCookieName(), clearOptions)
  }

  accessTokenCookieName(): string {
    return this.configService.get('cookies.accessTokenName', { infer: true })!
  }

  refreshTokenCookieName(): string {
    return this.configService.get('cookies.refreshTokenName', { infer: true })!
  }

  private accessTokenCookieOptions(keepSignIn: boolean): CookieOptions {
    return {
      ...this.baseCookieOptions(),
      maxAge: keepSignIn
        ? jwtExpiresInToMs(
            this.configService.get('jwt.accessExpiresIn', { infer: true })!
          )
        : this.configService.get('cookies.sessionAccessMaxAgeMs', {
            infer: true
          })!
    }
  }

  private refreshTokenCookieOptions(keepSignIn: boolean): CookieOptions {
    return {
      ...this.baseCookieOptions(),
      maxAge: keepSignIn
        ? jwtExpiresInToMs(
            this.configService.get('jwt.refreshExpiresIn', { infer: true })!
          )
        : this.configService.get('cookies.sessionRefreshMaxAgeMs', {
            infer: true
          })!
    }
  }

  private baseCookieOptions(): CookieOptions {
    const cookies = this.configService.get('cookies', { infer: true })!
    return {
      httpOnly: cookies.httpOnly,
      secure: cookies.secure,
      sameSite: cookies.sameSite,
      ...(cookies.partitioned ? { partitioned: true } : {}),
      ...(cookies.domain ? { domain: cookies.domain } : {}),
      path: cookies.path
    }
  }

  private clearCookieOptions(): CookieOptions {
    return this.baseCookieOptions()
  }
}
