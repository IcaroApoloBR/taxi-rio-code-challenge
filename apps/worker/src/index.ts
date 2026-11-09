import http from 'node:http';
import amqp, { ChannelModel } from 'amqplib';
import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';
import { consumeQueue, log } from './consume.js';
import { HistoryStore, RideEventDocument } from './history.js';
import { register } from './metrics.js';
import { StatusProjection } from './projection.js';
import { ensureTopology, historyQueue, statusQueue } from './topology.js';

const metricsPort = Number(process.env.METRICS_PORT ?? 9101);
const inFlight = new Set<Promise<void>>();
let stopping = false;

const metricsServer = http.createServer(async (req, res) => {
  if (req.url !== '/metrics') {
    res.writeHead(404).end();
    return;
  }
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

async function bootstrap(): Promise<void> {
  metricsServer.listen(metricsPort, '0.0.0.0');

  const rabbitUrl = required('RABBITMQ_URL');
  const mongoUrl = required('MONGO_URL');
  const redisHost = required('REDIS_HOST');

  const mongo = new MongoClient(mongoUrl);
  await mongo.connect();
  const events = mongo.db().collection<RideEventDocument>('ride_events');
  await events.createIndex({ eventId: 1 }, { unique: true });
  await events.createIndex({ rideId: 1, occurredAt: 1 });
  const history = new HistoryStore(events);

  const redis = new Redis({
    host: redisHost,
    port: numberSetting('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  redis.on('error', (error: Error) => {
    log('error', 'Redis client error', { error: error.message });
  });
  await redis.connect();
  const projection = new StatusProjection(redis);

  const connection = await amqp.connect(rabbitUrl);
  connection.on('error', (error: Error) => {
    log('error', 'RabbitMQ connection error', { error: error.message });
  });
  connection.on('close', () => {
    if (!stopping) {
      log('error', 'RabbitMQ connection closed');
      process.exit(1);
    }
  });

  const recreated = await ensureTopology(connection);
  if (recreated.length > 0) {
    log('info', 'Queues recreated for dead-letter arguments', { queues: recreated });
  }

  const channel = await connection.createChannel();
  channel.on('error', (error: Error) => {
    log('error', 'RabbitMQ channel error', { error: error.message });
  });
  await channel.prefetch(10);

  const consumers = [
    await consumeQueue(channel, historyQueue, (event) => history.record(event), inFlight, () => stopping),
    await consumeQueue(channel, statusQueue, (event) => projection.write(event), inFlight, () => stopping),
  ];

  log('info', 'Worker connected and consuming', { queues: [historyQueue, statusQueue] });

  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    log('info', 'Worker shutting down');
    for (const tag of consumers) {
      await channel.cancel(tag).catch(() => undefined);
    }
    await Promise.race([
      Promise.all([...inFlight]),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
    await channel.close().catch(() => undefined);
    await closeConnection(connection);
    await mongo.close().catch(() => undefined);
    await redis.quit().catch(() => undefined);
    metricsServer.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function numberSetting(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a valid port`);
  }
  return parsed;
}

async function closeConnection(connection: ChannelModel): Promise<void> {
  await connection.close().catch(() => undefined);
}

bootstrap().catch((error: unknown) => {
  log('error', 'Worker bootstrap failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});
