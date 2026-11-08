import http from 'node:http';
import amqp, { type Channel, type ConsumeMessage } from 'amqplib';
import { collectDefaultMetrics, register } from 'prom-client';

const service = 'worker';
const metricsPort = Number(process.env.METRICS_PORT ?? 9101);
const rabbitUrl = process.env.RABBITMQ_URL;

collectDefaultMetrics({ register, prefix: 'corridas_worker_' });

const metricsServer = http.createServer(async (req, res) => {
  if (req.url !== '/metrics') {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

function log(level: 'info' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...fields,
  }) + '\n');
}

async function handleMessage(channel: Channel, message: ConsumeMessage): Promise<void> {
  const raw = message.content.toString();
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    log('error', 'Invalid event JSON; rejecting without requeue', {
      routingKey: message.fields.routingKey,
    });
    channel.nack(message, false, false);
    return;
  }

  // TODO: Persist event idempotently in MongoDB and update Redis projection.
  // Acknowledge only after all required effects have been committed.
  log('info', 'Received event (scaffold only; persistence not implemented)', {
    eventId: event.eventId,
    eventType: event.eventType,
    correlationId: event.correlationId,
  });

  // This ack is temporary scaffold behavior. Replace it when persistence is implemented.
  channel.ack(message);
}

async function bootstrap(): Promise<void> {
  metricsServer.listen(metricsPort, '0.0.0.0');
  if (!rabbitUrl) {
    throw new Error('RABBITMQ_URL is required');
  }

  const connection = await amqp.connect(rabbitUrl);
  const channel = await connection.createChannel();
  await channel.assertExchange('corridas.events', 'topic', { durable: true });
  await channel.assertQueue('corridas.history', { durable: true });
  await channel.bindQueue('corridas.history', 'corridas.events', 'corrida.*');
  await channel.prefetch(10);

  await channel.consume('corridas.history', (message) => {
    if (message) void handleMessage(channel, message);
  }, { noAck: false });

  log('info', 'Worker connected and consuming', { queue: 'corridas.history' });

  const shutdown = async (): Promise<void> => {
    log('info', 'Worker shutting down');
    await channel.close();
    await connection.close();
    metricsServer.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

bootstrap().catch((error: unknown) => {
  log('error', 'Worker bootstrap failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
