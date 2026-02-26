import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  success: boolean
  message: string
  data?: T
  metadata?: any
  error?: string[]
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return data as Response<T>
        }

        if (data && typeof data === 'object' && 'data' in data) {
          const responseData = data as {
            message?: string
            data: T
            metadata?: unknown
          }
          return {
            success: true,
            message: responseData.message || 'Operation successful',
            data: responseData.data,
            metadata: responseData.metadata
          }
        }

        // Handle responses that only contain a message (e.g., delete, activate, deactivate operations)
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          Object.keys(data).length <= 2
        ) {
          const messageData = data as { message: string; pending_action?: unknown }
          return {
            success: true,
            message: messageData.message,
            data: messageData.pending_action ? data as T : undefined
          }
        }

        return {
          success: true,
          message: 'Operation successful',
          data: data as T
        }
      })
    )
  }
}
