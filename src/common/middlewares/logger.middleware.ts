import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'
import { ActivityLogService } from '../../modules/activity-log/activity-log.service'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly activityLogService: ActivityLogService) {}
  // ANSI color codes
  private colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m'
  }

  private extractResourceType(path: string): string {
    const pathSegments = path.split('/').filter(Boolean)
    if (pathSegments.length === 0) return 'unknown'
    const resourceMap: Record<string, string> = {
      portfolios: 'Portfolio',
      'sub-portfolios': 'Sub Portfolio',
      properties: 'Property',
      users: 'User',
      'user-roles': 'User Role',
      'project-roles': 'Project Role',
      'user-invitations': 'User Invitation',
      currencies: 'Currency',
      'service-types': 'Service Type',
      'property-credentials': 'Property Credentials',
      'file-upload': 'File Upload',
      auth: 'Auth'
    }
    const firstSegment = pathSegments[0].toLowerCase()
    return resourceMap[firstSegment] || 'System'
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now()
    const { method, originalUrl, url } = req

    // Extract module name from URL
    const path = originalUrl || url

    // Skip logging for known harmless browser/tool requests
    const ignoredPaths = [
      '/.well-known/appspecific/com.chrome.devtools.json',
      '/favicon.ico'
    ]

    // Log after response is sent
    res.on('finish', () => {
      // Skip logging for ignored paths
      if (ignoredPaths.includes(path)) {
        return
      }

      const responseTime = Date.now() - startTime
      const { statusCode } = res

      // Color code based on status code
      let statusColor = this.colors.green
      if (statusCode >= 500) statusColor = this.colors.red
      else if (statusCode >= 400) statusColor = this.colors.yellow
      else if (statusCode >= 300) statusColor = this.colors.cyan

      // Color code based on method
      let methodColor = this.colors.blue
      if (method === 'POST') methodColor = this.colors.green
      else if (method === 'PUT' || method === 'PATCH')
        methodColor = this.colors.yellow
      else if (method === 'DELETE') methodColor = this.colors.red

      // Format and log the request
      console.log(
        `${methodColor}${method}${this.colors.reset} ` +
          `${this.colors.cyan}${path}${this.colors.reset} ` +
          `${statusColor}${statusCode}${this.colors.reset} ` +
          `${this.colors.magenta}${responseTime}ms${this.colors.reset} `
      )
      const user = (req as any).user
      const username = user?.email || 'anonymous'
      // const role = user?.role?.name || 'guest'
      const role = user?.user_role_id || 'guest'
      const resource = this.extractResourceType(path)
      const success = statusCode >= 200 && statusCode < 300


      if (!(path.startsWith('/api/activity-logs') && method === 'GET')) {
        this.activityLogService
          .logActivity({
            username,
            role,
            endpoint: method + ' ' + path,
            success,
            statusCode,
            ipAddress: req.ip || 'unknown',
            resource,
            responseTime
          })
          .catch((err) => console.error('Error in activity logging:', err))
      }
    })

    next()
  }
}
