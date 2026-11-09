import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { ConfirmChannel, ChannelModel } from 'amqplib';
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
    const body = Buffer.from(JSON.stringify(event));
    const accepted = channel.publish(rideEventsExchange, event.eventType, body, {
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      correlationId: event.correlationId ?? undefined,
      type: event.eventType,
      appId: 'taxi-api',
    });
    if (!accepted) {
      await new Promise<void>((resolve) => channel.once('drain', () => resolve()));
    }
    await channel.waitForConfirms();
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
