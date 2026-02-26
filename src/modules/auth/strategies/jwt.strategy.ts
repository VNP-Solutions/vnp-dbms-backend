import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Configuration } from '../../../config/configuration'
import type { IAuthRepository, JwtPayload } from '../auth.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(ConfigService)
    private configService: ConfigService<Configuration>,
    @Inject('IAuthRepository')
    private authRepository: IAuthRepository
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessSecret', { infer: true })!
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.authRepository.findUserByEmail(payload.email)

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return {
      id: user.id,
      email: user.email,
      user_role_id: user.user_role_id,
      role: user.role
    }
  }
}
