import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Request, Response } from 'express'

interface ErrorResponse {
  success: boolean
  message: string
  error: string[]
  data: null
  statusCode: number
  timestamp: string
  path: string
  stack?: string
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let errors: string[] = []

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
        errors = [exceptionResponse]
      } else if (typeof exceptionResponse === 'object') {
        const errorObj = exceptionResponse as Record<string, unknown>
        message =
          (errorObj.message as string) ||
          exception.message ||
          'An error occurred'

        if (Array.isArray(errorObj.message)) {
          errors = errorObj.message as string[]
        } else if (typeof errorObj.message === 'string') {
          errors = [errorObj.message]
        } else {
          errors = [message]
        }
      }
    }
    // Handle Prisma Known Request Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const prismaError = this.handlePrismaError(exception)
      status = prismaError.status
      message = prismaError.message
      errors = [prismaError.message]
    }
    // Handle Prisma Validation Errors
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST
      message = 'Validation error in database query'
      errors = [this.extractPrismaValidationError(exception.message)]
    }
    // Handle Prisma Initialization Errors
    else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE
      message = 'Database connection error'
      errors = ['Unable to connect to the database. Please try again later.']
    }
    // Handle Prisma Rust Panic Errors
    else if (exception instanceof Prisma.PrismaClientRustPanicError) {
      status = HttpStatus.INTERNAL_SERVER_ERROR
      message = 'Database internal error'
      errors = ['A critical database error occurred. Please contact support.']
    }
    // Handle generic errors
    else if (exception instanceof Error) {
      message = exception.message
      errors = [exception.message]

      // Handle specific error patterns
      if (exception.message.includes('duplicate key')) {
        status = HttpStatus.CONFLICT
        message = 'Duplicate entry detected'
        errors = [this.extractDuplicateKeyError(exception.message)]
      } else if (exception.message.includes('foreign key constraint')) {
        status = HttpStatus.BAD_REQUEST
        message = 'Foreign key constraint violation'
        errors = ['The requested operation violates data integrity constraints']
      } else if (exception.message.includes('not found')) {
        status = HttpStatus.NOT_FOUND
        message = 'Resource not found'
      }
    }

    // Log the error for debugging
    this.logError(exception, request, status)

    // Build error response
    const errorResponse: ErrorResponse = {
      success: false,
      message,
      error: errors,
      data: null,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url
    }

    // Include stack trace only in development
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      errorResponse.stack = exception.stack
    }

    response.status(status).json(errorResponse)
  }

  private handlePrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number
    message: string
  } {
    const code = exception.code

    switch (code) {
      case 'P2002': {
        // Unique constraint violation
        const target = exception.meta?.target as string[] | undefined
        const field = target ? target.join(', ') : 'field'
        return {
          status: HttpStatus.CONFLICT,
          message: `A record with this ${field} already exists`
        }
      }

      case 'P2025': {
        // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found or already deleted'
        }
      }

      case 'P2003': {
        // Foreign key constraint failed
        const fieldName = exception.meta?.field_name as string | undefined
        return {
          status: HttpStatus.BAD_REQUEST,
          message: fieldName
            ? `Invalid reference for field: ${fieldName}`
            : 'Foreign key constraint violation'
        }
      }

      case 'P2014': {
        // Required relation violation
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Required relation is missing or invalid'
        }
      }

      case 'P2011': {
        // Null constraint violation
        const nullField = exception.meta?.constraint as string | undefined
        return {
          status: HttpStatus.BAD_REQUEST,
          message: nullField
            ? `Field ${nullField} cannot be null`
            : 'Required field is missing'
        }
      }

      case 'P2016': {
        // Query interpretation error
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid query parameters'
        }
      }

      case 'P2021': {
        // Table does not exist
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database schema error'
        }
      }

      case 'P2024': {
        // Connection timeout
        return {
          status: HttpStatus.REQUEST_TIMEOUT,
          message: 'Database connection timeout'
        }
      }

      default: {
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Database error: ${exception.message}`
        }
      }
    }
  }

  private extractPrismaValidationError(errorMessage: string): string {
    const lines = errorMessage.split('\n')
    const relevantLine = lines.find(
      line => line.includes('Argument') || line.includes('Unknown')
    )
    return relevantLine?.trim() || 'Invalid data provided'
  }

  private extractDuplicateKeyError(errorMessage: string): string {
    const match = errorMessage.match(/duplicate key error.*?index: (\w+)/)
    if (match) {
      return `A record with this ${match[1]} already exists`
    }
    return 'This record already exists in the database'
  }

  private logError(exception: unknown, request: Request, status: number): void {
    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error'
    const errorStack = exception instanceof Error ? exception.stack : ''

    // Skip logging for known harmless browser/tool requests
    const ignoredPaths = [
      '/.well-known/appspecific/com.chrome.devtools.json',
      '/favicon.ico'
    ]

    if (status === 404 && ignoredPaths.includes(request.url)) {
      return
    }

    this.logger.error(
      `HTTP Status: ${status} | Method: ${request.method} | Path: ${request.url} | Message: ${errorMessage}`,
      errorStack
    )
  }
}
