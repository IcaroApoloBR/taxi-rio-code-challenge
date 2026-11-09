import { Channel, ConsumeMessage } from 'amqplib';
import { deathCount, maxDeliveries } from './delivery.js';
import { InvalidRideEvent, RideEvent, parseRideEvent } from './event.js';
import { eventsTotal } from './metrics.js';
import { rideDeadLetterExchange } from './topology.js';

export function log(level: 'info' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'worker',
      message,
      ...fields,
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
      job = onMessage(channel, queue, message, handle, isStopping)
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

async function onMessage(
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

  let event: RideEvent;
  try {
    event = parseRideEvent(message.content.toString());
  } catch (error) {
    log('error', 'Invalid event; sending to DLQ', {
      queue,
      reason: error instanceof Error ? error.message : 'invalid',
    });
    deadLetter(channel, message, queue);
    eventsTotal.inc({ queue, result: 'invalid' });
    return;
  }

  if (deathCount(message, queue) >= maxDeliveries) {
    log('error', 'Delivery limit reached; sending to DLQ', {
      queue,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });
    deadLetter(channel, message, queue);
    eventsTotal.inc({ queue, result: 'dead' });
    return;
  }

  try {
    const result = await handle(event);
    channel.ack(message);
    eventsTotal.inc({ queue, result });
    log('info', 'Event processed', {
      queue,
      eventId: event.eventId,
      eventType: event.eventType,
      correlationId: event.correlationId,
      result,
    });
  } catch (error) {
    if (error instanceof InvalidRideEvent) {
      log('error', 'Event rejected; sending to DLQ', {
        queue,
        eventId: event.eventId,
        correlationId: event.correlationId,
        reason: error.message,
      });
      deadLetter(channel, message, queue);
      eventsTotal.inc({ queue, result: 'invalid' });
      return;
    }
    log('error', 'Event processing failed; scheduling retry', {
      queue,
      eventId: event.eventId,
      correlationId: event.correlationId,
      error: error instanceof Error ? error.message : 'error',
    });
    channel.nack(message, false, false);
    eventsTotal.inc({ queue, result: 'retry' });
  }
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
