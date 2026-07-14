import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { SignOptions } from 'jsonwebtoken'
import type { Configuration } from '../../config/configuration'

@Injectable()
export class ExternalAuthService {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly jwtService: JwtService
  ) {}

  generateCommunicationToken(): { token: string; expiresIn: string } {
    this.getCommunicationSecret()

    const expiresIn = this.configService.get('jwt.communicationExpiresIn', { infer: true }) ?? '1d'

    const token = this.jwtService.sign(
      { type: 'external-communication' },
      { expiresIn: expiresIn as NonNullable<SignOptions['expiresIn']> }
    )

    return { token, expiresIn }
  }

  private getCommunicationSecret(): string {
    const secret = this.configService.get('jwt.communicationSecret', { infer: true })

    if (!secret) {
      throw new BadRequestException('JWT_COMMUNICATION_SECRET is not configured')
    }

    return secret
  }
}
