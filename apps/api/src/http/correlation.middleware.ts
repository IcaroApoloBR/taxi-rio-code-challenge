import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export interface CorrelatedRequest extends Request {
  correlationId?: string;
}

export function correlationMiddleware(request: CorrelatedRequest, response: Response, next: NextFunction): void {
  const incoming = request.header('x-correlation-id');
  const correlationId = incoming && incoming.trim().length > 0 && incoming.length <= 100 ? incoming.trim() : randomUUID();
  request.correlationId = correlationId;
  response.setHeader('X-Correlation-Id', correlationId);
  next();
}
