import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CorrelatedRequest } from './correlation.middleware';

export const CorrelationId = createParamDecorator((_: unknown, context: ExecutionContext): string | null => {
  const request = context.switchToHttp().getRequest<CorrelatedRequest>();
  return request.correlationId ?? null;
});
