import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { NextFunction, Response } from 'express';
import { CorrelatedRequest } from './correlation.middleware';
import { httpRequestDuration, httpRequestErrors, httpRequests } from './http-metrics';
import { writeLog } from './log';

export function accessLogMiddleware(request: CorrelatedRequest, response: Response, next: NextFunction): void {
  const started = process.hrtime.bigint();
  const span = trace.getTracer('taxi-rio').startSpan(`HTTP ${request.method}`);
  if (request.correlationId) {
    span.setAttribute('correlation_id', request.correlationId);
  }
  response.on('finish', () => {
    const route = templateRoute(request);
    const status = response.statusCode;
    const durationSeconds = Number(process.hrtime.bigint() - started) / 1e9;
    span.updateName(`${request.method} ${route}`);
    span.setAttribute('http.request.method', request.method);
    span.setAttribute('http.route', route);
    span.setAttribute('http.response.status_code', status);
    if (status >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    span.end();
    httpRequests.inc({ method: request.method, route, status: String(status) });
    httpRequestDuration.observe({ method: request.method, route }, durationSeconds);
    if (status >= 500) {
      httpRequestErrors.inc({ method: request.method, route });
    }
    const spanContext = span.spanContext();
    const rideId = typeof request.params?.id === 'string' ? request.params.id : undefined;
    writeLog('info', 'HTTP request', {
      correlation_id: request.correlationId,
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      method: request.method,
      route,
      status,
      duration_ms: Math.round(durationSeconds * 1000),
      ...(rideId ? { ride_id: rideId } : {}),
    });
  });
  context.with(trace.setSpan(context.active(), span), () => next());
}

function templateRoute(request: CorrelatedRequest): string {
  const route = request.route as { path?: string } | undefined;
  if (!route?.path) return 'unmatched';
  const base = request.baseUrl ?? '';
  return `${base}${route.path.startsWith('/') ? route.path : `/${route.path}`}`;
}
