import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { isNotApplicableToken } from '../utils/not-applicable.util'

/**
 * Turns every "N/A" in the request body into null before validation runs, so
 * a user can clear a field of any type — a number or date field would
 * otherwise reject the string outright.
 *
 * Nested objects (e.g. credentials) are covered too. Array elements are left
 * alone: an "N/A" inside a list is not a request to clear the list.
 */
@Injectable()
export class NotApplicableToNullInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ body?: unknown }>()
    if (isPlainObject(request.body)) nullifyNotApplicable(request.body)
    return next.handle()
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullifyNotApplicable(obj: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(obj)) {
    if (isNotApplicableToken(value)) obj[key] = null
    else if (isPlainObject(value)) nullifyNotApplicable(value)
  }
}
