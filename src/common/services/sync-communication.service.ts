import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import type { SignOptions } from 'jsonwebtoken'
import type { Configuration } from '../../config/configuration'

@Injectable()
export class SyncCommunicationService {
  private readonly logger = new Logger(SyncCommunicationService.name)

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<Configuration, true>
  ) {}

  isConfigured(): boolean {
    return !!this.getSecret()
  }

  signCommunicationToken(): string {
    const secret = this.getSecret()
    if (!secret) {
      throw new Error('JWT_COMMUNICATION_SECRET is not configured')
    }

    const expiresIn = (this.config.get('jwt.communicationExpiresIn', {
      infer: true
    }) ?? '1d') as SignOptions['expiresIn']

    return this.jwtService.sign(
      { type: 'external-communication' },
      { secret, expiresIn }
    )
  }

  createAuthHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.signCommunicationToken()}` }
  }

  private getSecret(): string | undefined {
    const secret = this.config.get('jwt.communicationSecret', { infer: true })
    if (!secret) {
      this.logger.warn('[sync] JWT_COMMUNICATION_SECRET is not configured')
    }
    return secret || undefined
  }
}
