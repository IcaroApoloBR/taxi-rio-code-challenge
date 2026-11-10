import { context, propagation, ROOT_CONTEXT, SpanStatusCode, trace, type Attributes, type Link } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace';

let provider: TracerProvider | null = null;

export function startTracing(serviceName: string): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || provider) return;
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  const exporter = new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` });
  provider = new TracerProvider({
    resource: resourceFromAttributes({ 'service.name': serviceName }),
    spanProcessors: [new BatchSpanProcessor({ exporter, scheduledDelayMillis: 1000 })],
  });
  trace.setGlobalTracerProvider(provider);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
}

export async function shutdownTracing(): Promise<void> {
  const current = provider;
  provider = null;
  await current?.shutdown();
}

export function linksFromCarrier(carrier: Record<string, string>): Link[] {
  if (!carrier.traceparent) return [];
  const extracted = propagation.extract(ROOT_CONTEXT, carrier);
  const spanContext = trace.getSpanContext(extracted);
  if (!spanContext || !trace.isSpanContextValid(spanContext)) return [];
  return [{ context: spanContext }];
}

export function carrierFromHeaders(headers: Record<string, unknown> | undefined): Record<string, string> {
  const carrier: Record<string, string> = {};
  if (!headers) return carrier;
  for (const key of ['traceparent', 'tracestate']) {
    const value = headers[key];
    if (typeof value === 'string') carrier[key] = value;
    else if (Buffer.isBuffer(value)) carrier[key] = value.toString('utf8');
  }
  return carrier;
}

export async function withSpan<T>(name: string, attributes: Attributes, work: () => Promise<T>): Promise<T> {
  return trace.getTracer('taxi-rio').startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await work();
      span.end();
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

export function traceFields(): Record<string, string> {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}
