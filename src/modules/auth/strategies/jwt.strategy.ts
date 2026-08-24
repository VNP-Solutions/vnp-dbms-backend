import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import type { Request } from 'express'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Configuration } from '../../../config/configuration'
import { AuthCookieService } from '../auth-cookie.service'
import type { IAuthRepository, JwtPayload } from '../auth.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>,
    @Inject('IAuthRepository')
    private authRepository: IAuthRepository,
    authCookieService: AuthCookieService
  ) {
    const accessCookieName = authCookieService.accessTokenCookieName()
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[accessCookieName] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken()
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessSecret', { infer: true })!
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authRepository.findUserByEmail(payload.email)

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const projectRoles = user.userProjectRoles?.map(upr => ({
      project_type: upr.project_role.project_type,
      user_role_id: upr.user_role_id,
      user_role: {
        id: upr.user_role.id,
        name: upr.user_role.name,
        description: upr.user_role.description || '',
        is_external: upr.user_role.is_external,
        can_access_mis: upr.user_role.can_access_mis ?? false,
        portfolio_permission: upr.user_role.portfolio_permission,
        property_permission: upr.user_role.property_permission,
        audit_permission: upr.user_role.audit_permission,
        user_permission: upr.user_role.user_permission,
        system_settings_permission: upr.user_role.system_settings_permission,
        bank_details_permission: upr.user_role.bank_details_permission,
        roles_permission: upr.user_role.roles_permission,
        access_logs_permission: upr.user_role.access_logs_permission
      },
      portfolio_ids: upr.portfolio_ids || [],
      subportfolio_ids: upr.subportfolio_ids || [],
      property_ids: upr.property_ids || [],
      is_active: upr.is_active
    })) || []

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_role_id: user.user_role_id,
      role: user.role,
      projectRoles
    }
  }
}
