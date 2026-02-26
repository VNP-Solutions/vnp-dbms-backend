import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass()
    ])

    if (isPublic) {
      return true
    }

    return super.canActivate(context)
  }

  handleRequest(err: any, user: any, info: any) {
    // Handle specific JWT authentication errors with 401 status
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Access token has expired. Please refresh your token.')
      }
      
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid access token. Please authenticate again.')
      }
      
      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('Access token is not yet valid.')
      }
      
      if (info?.message === 'No auth token') {
        throw new UnauthorizedException('No access token provided. Please authenticate.')
      }

      // Generic authentication error
      throw err || new UnauthorizedException('Authentication failed. Please provide a valid access token.')
    }

    return user
  }
}
