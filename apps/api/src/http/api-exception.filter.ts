import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { InvalidCredentialsError } from '../auth/invalid-credentials.error';
import { IdempotencyConflictError, RideConflictError, RideNotFoundError } from '../rides/ride';

interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  correlationId: string;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<RequestWithCorrelation>();
    const body = toErrorBody(exception, request.correlationId ?? randomUUID());
    response.status(body.statusCode).json(body);
  }
}

function toErrorBody(exception: unknown, correlationId: string): ApiErrorBody {
  if (exception instanceof RideNotFoundError) {
    return { statusCode: HttpStatus.NOT_FOUND, code: 'RIDE_NOT_FOUND', message: exception.message, correlationId };
  }
  if (exception instanceof RideConflictError) {
    return { statusCode: HttpStatus.CONFLICT, code: exception.code, message: exception.message, correlationId };
  }
  if (exception instanceof InvalidCredentialsError) {
    return { statusCode: HttpStatus.UNAUTHORIZED, code: 'UNAUTHORIZED', message: exception.message, correlationId };
  }
  if (exception instanceof IdempotencyConflictError) {
    return { statusCode: HttpStatus.CONFLICT, code: 'IDEMPOTENCY_CONFLICT', message: exception.message, correlationId };
  }
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    return {
      statusCode,
      code: codeForStatus(statusCode, exception),
      message: messageOf(exception),
      correlationId,
    };
  }
  console.error(exception);
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Erro interno.',
    correlationId,
  };
}

function codeForStatus(statusCode: number, exception: HttpException): string {
  if (statusCode === HttpStatus.BAD_REQUEST && isValidation(exception)) {
    return 'VALIDATION_ERROR';
  }
  if (statusCode === HttpStatus.BAD_REQUEST) {
    return 'BAD_REQUEST';
  }
  if (statusCode === HttpStatus.UNAUTHORIZED) {
    return 'UNAUTHORIZED';
  }
  if (statusCode === HttpStatus.FORBIDDEN) {
    return 'FORBIDDEN';
  }
  return 'HTTP_ERROR';
}

function isValidation(exception: HttpException): boolean {
  const response = exception.getResponse();
  return typeof response === 'object' && response !== null && 'message' in response && Array.isArray(response.message);
}

function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const message = response.message;
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return exception.message;
}
