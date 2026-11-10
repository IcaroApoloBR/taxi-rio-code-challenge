import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { ConfirmChannel, ChannelModel } from 'amqplib';
import { setOldestMessageAge } from '../http/http-metrics';
import { injectTraceHeaders, linksFromTraceParent } from '../http/tracing';
import { ensureTopology, rideEventsExchange } from './rabbit-topology';
import { RideEventEnvelope } from './ride-event';
import { OutboxRepository } from './ride.repository';

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;

  constructor(private readonly outbox: OutboxRepository) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 1_000);
    this.timer.unref();
    void this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.drop();
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.ensureConnected();
      const published = await this.outbox.publishPending((event) => this.send(event));
      if (published > 0) {
        this.logger.log(`Publicados ${published} eventos do outbox.`);
      }
    } catch (error) {
      this.logger.warn(`Publicação do outbox adiada: ${error instanceof Error ? error.message : 'erro'}`);
      await this.drop();
    } finally {
      try {
        setOldestMessageAge(await this.outbox.oldestPendingAgeSeconds());
      } catch (error) {
        this.logger.warn(`Idade do outbox indisponível: ${error instanceof Error ? error.message : 'erro'}`);
      }
      this.running = false;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.channel) return;
    const url = process.env.RABBITMQ_URL;
    if (!url) {
      throw new Error('RABBITMQ_URL é obrigatória para publicar o outbox.');
    }
    const connection = await amqp.connect(url);
    connection.on('error', () => undefined);
    connection.on('close', () => {
      this.connection = null;
      this.channel = null;
    });
    try {
      const recreated = await ensureTopology(connection);
      if (recreated.length > 0) {
        this.logger.warn(`Filas recriadas para receber dead-letter: ${recreated.join(', ')}`);
      }
      const channel = await connection.createConfirmChannel();
      channel.on('error', () => undefined);
      channel.on('close', () => {
        this.channel = null;
      });
      this.connection = connection;
      this.channel = channel;
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  private async send(event: RideEventEnvelope): Promise<void> {
    const channel = this.channel;
    if (!channel) {
      throw new Error('Canal do RabbitMQ indisponível.');
    }
    const span = trace.getTracer('taxi-rio').startSpan('publish outbox event', {
      links: linksFromTraceParent(event.traceParent),
      attributes: {
        'messaging.system': 'rabbitmq',
        'messaging.destination.name': rideEventsExchange,
        'messaging.operation.name': event.eventType,
        'messaging.message.id': event.eventId,
        ...(event.correlationId ? { correlation_id: event.correlationId } : {}),
        ride_id: event.payload.rideId,
      },
    });
    const headers: Record<string, string> = {};
    context.with(trace.setSpan(context.active(), span), () => {
      injectTraceHeaders(headers);
    });
    try {
      const body = Buffer.from(JSON.stringify(publishedEvent(event)));
      const accepted = channel.publish(rideEventsExchange, event.eventType, body, {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        correlationId: event.correlationId ?? undefined,
        type: event.eventType,
        appId: 'taxi-api',
        headers,
      });
      if (!accepted) {
        await new Promise<void>((resolve) => channel.once('drain', () => resolve()));
      }
      await channel.waitForConfirms();
      span.end();
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  }

  private async drop(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  }
}

function publishedEvent(event: RideEventEnvelope): Omit<RideEventEnvelope, 'traceParent'> {
  const { traceParent, ...body } = event;
  void traceParent;
  return body;
}
