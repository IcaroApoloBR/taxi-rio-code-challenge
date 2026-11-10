import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { Channel, ConsumeMessage } from 'amqplib';
import { deathCount, maxDeliveries } from './delivery.js';
import { InvalidRideEvent, RideEvent, parseRideEvent } from './event.js';
import { eventDuration, eventsFailed, eventsProcessed } from './metrics.js';
import { rideDeadLetterExchange } from './topology.js';
import { carrierFromHeaders, linksFromCarrier, traceFields } from './tracing.js';

export function log(level: 'info' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'worker',
      message,
      ...fields,
      ...traceFields(),
    }) + '\n',
  );
}

export async function consumeQueue(
  channel: Channel,
  queue: string,
  handle: (event: RideEvent) => Promise<'processed' | 'duplicate'>,
  inFlight: Set<Promise<void>>,
  isStopping: () => boolean,
): Promise<string> {
  const consumer = await channel.consume(
    queue,
    (message) => {
      if (!message) return;
      let job!: Promise<void>;
      job = handleDelivery(channel, queue, message, handle, isStopping)
        .catch((error: unknown) => {
          log('error', 'Consumer failed', { queue, error: error instanceof Error ? error.message : 'error' });
        })
        .finally(() => inFlight.delete(job));
      inFlight.add(job);
    },
    { noAck: false },
  );
  return consumer.consumerTag;
}

export async function handleDelivery(
  channel: Channel,
  queue: string,
  message: ConsumeMessage,
  handle: (event: RideEvent) => Promise<'processed' | 'duplicate'>,
  isStopping: () => boolean,
): Promise<void> {
  if (isStopping()) {
    channel.nack(message, false, true);
    return;
  }

  const started = process.hrtime.bigint();
  let eventType = 'unknown';
  const finish = (result: 'processed' | 'duplicate' | 'invalid' | 'dead' | 'retry'): void => {
    eventDuration.observe({ event_type: eventType }, Number(process.hrtime.bigint() - started) / 1e9);
    if (result === 'processed' || result === 'duplicate') {
      eventsProcessed.inc({ event_type: eventType, result });
      return;
    }
    eventsFailed.inc({ event_type: eventType, result });
  };

  let event: RideEvent;
  try {
    event = parseRideEvent(message.content.toString());
    eventType = event.eventType;
  } catch (error) {
    log('error', 'Invalid event; sending to DLQ', {
      queue,
      reason: error instanceof Error ? error.message : 'invalid',
    });
    deadLetter(channel, message, queue);
    finish('invalid');
    return;
  }

  if (deathCount(message, queue) >= maxDeliveries) {
    log('error', 'Delivery limit reached; sending to DLQ', {
      queue,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });
    deadLetter(channel, message, queue);
    finish('dead');
    return;
  }

  const span = trace.getTracer('taxi-rio').startSpan(`consume ${queue}`, {
    links: linksFromCarrier(carrierFromHeaders(message.properties.headers)),
    attributes: {
      'messaging.system': 'rabbitmq',
      'messaging.destination.name': queue,
      'messaging.operation.name': event.eventType,
      'messaging.message.id': event.eventId,
      ...(event.correlationId ? { correlation_id: event.correlationId } : {}),
      ride_id: event.payload.rideId,
    },
  });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => handle(event));
    channel.ack(message);
    finish(result);
    log('info', 'Event processed', {
      queue,
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      result,
      ...spanFields(span),
    });
    span.end();
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    if (error instanceof InvalidRideEvent) {
      log('error', 'Event rejected; sending to DLQ', {
        queue,
        eventId: event.eventId,
        correlationId: event.correlationId,
        reason: error.message,
        ...spanFields(span),
      });
      deadLetter(channel, message, queue);
      finish('invalid');
      return;
    }
    log('error', 'Event processing failed; scheduling retry', {
      queue,
      eventId: event.eventId,
      correlationId: event.correlationId,
      error: error instanceof Error ? error.message : 'error',
      ...spanFields(span),
    });
    channel.nack(message, false, false);
    finish('retry');
  }
}

function spanFields(span: Span): Record<string, string> {
  const spanContext = span.spanContext();
  if (!trace.isSpanContextValid(spanContext)) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

function deadLetter(channel: Channel, message: ConsumeMessage, queue: string): void {
  channel.publish(rideDeadLetterExchange, '', message.content, {
    persistent: true,
    contentType: message.properties.contentType ?? 'application/json',
    messageId: message.properties.messageId,
    correlationId: message.properties.correlationId,
    headers: {
      ...(message.properties.headers ?? {}),
      'x-origin-queue': queue,
    },
  });
  channel.ack(message);
}
