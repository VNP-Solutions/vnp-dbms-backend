import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * Validates that the Bearer token exactly matches JWT_COMMUNICATION_SECRET.
 * Used for the generate-token endpoint so an external service can exchange
 * the raw secret for a short-lived signed JWT.
 */
@Injectable()
export class ExternalRawSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Record<string, any>>()
    const authHeader = request.headers?.authorization as string | undefined

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7).trim()
    const secret = this.configService.get<string>('JWT_COMMUNICATION_SECRET')

    if (!secret) {
      throw new UnauthorizedException(
        'Communication secret is not configured on this server',
      )
    }

    if (token !== secret) {
      throw new UnauthorizedException('Invalid communication secret')
    }

    return true
  }
}
