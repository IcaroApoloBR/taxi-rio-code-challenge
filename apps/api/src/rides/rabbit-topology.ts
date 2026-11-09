// A mesma topologia é declarada em apps/worker/src/topology.ts.
import { Channel, ChannelModel, Options } from 'amqplib';

export const rideEventsExchange = 'corridas.events';
export const rideRetryExchange = 'corridas.retry';
export const rideReturnExchange = 'corridas.return';
export const rideDeadLetterExchange = 'corridas.dlx';
export const rideDeadLetterQueue = 'corridas.dead-letter';
export const historyQueue = 'corridas.history';
export const historyRetryQueue = 'corridas.history.retry';
export const statusQueue = 'corridas.status-cache';
export const statusRetryQueue = 'corridas.status-cache.retry';
export const retryTtlMs = 5_000;

interface Binding {
  exchange: string;
  pattern: string;
}

export async function ensureTopology(connection: ChannelModel): Promise<string[]> {
  const setup = track(await connection.createChannel());
  await setup.assertExchange(rideEventsExchange, 'topic', { durable: true });
  await setup.assertExchange(rideRetryExchange, 'direct', { durable: true });
  await setup.assertExchange(rideReturnExchange, 'direct', { durable: true });
  await setup.assertExchange(rideDeadLetterExchange, 'fanout', { durable: true });
  await setup.assertQueue(rideDeadLetterQueue, { durable: true });
  await setup.bindQueue(rideDeadLetterQueue, rideDeadLetterExchange, '');
  await setup.close();

  const recreated: string[] = [];
  const queues: Array<{ name: string; options: Options.AssertQueue; bindings: Binding[] }> = [
    {
      name: historyQueue,
      options: {
        durable: true,
        deadLetterExchange: rideRetryExchange,
        deadLetterRoutingKey: historyQueue,
      },
      bindings: [
        { exchange: rideEventsExchange, pattern: 'corrida.criada' },
        { exchange: rideEventsExchange, pattern: 'corrida.status_alterado' },
        { exchange: rideReturnExchange, pattern: historyQueue },
      ],
    },
    {
      name: historyRetryQueue,
      options: {
        durable: true,
        messageTtl: retryTtlMs,
        deadLetterExchange: rideReturnExchange,
        deadLetterRoutingKey: historyQueue,
      },
      bindings: [{ exchange: rideRetryExchange, pattern: historyQueue }],
    },
    {
      name: statusQueue,
      options: {
        durable: true,
        deadLetterExchange: rideRetryExchange,
        deadLetterRoutingKey: statusQueue,
      },
      bindings: [
        { exchange: rideEventsExchange, pattern: 'corrida.status_alterado' },
        { exchange: rideReturnExchange, pattern: statusQueue },
      ],
    },
    {
      name: statusRetryQueue,
      options: {
        durable: true,
        messageTtl: retryTtlMs,
        deadLetterExchange: rideReturnExchange,
        deadLetterRoutingKey: statusQueue,
      },
      bindings: [{ exchange: rideRetryExchange, pattern: statusQueue }],
    },
  ];

  for (const queue of queues) {
    if (await ensureQueue(connection, queue.name, queue.options, queue.bindings)) {
      recreated.push(queue.name);
    }
  }
  return recreated;
}

async function ensureQueue(connection: ChannelModel, name: string, options: Options.AssertQueue, bindings: Binding[]): Promise<boolean> {
  const recreated = await assertOrRecreate(connection, name, options);
  const channel = track(await connection.createChannel());
  for (const binding of bindings) {
    await channel.bindQueue(name, binding.exchange, binding.pattern);
  }
  await channel.close();
  return recreated;
}

async function assertOrRecreate(connection: ChannelModel, name: string, options: Options.AssertQueue): Promise<boolean> {
  const channel = track(await connection.createChannel());
  const failure = await new Promise<Error | null>((resolve) => {
    let settled = false;
    const finish = (error: Error | null): void => {
      if (settled) return;
      settled = true;
      resolve(error);
    };
    channel.once('error', (error: Error) => finish(error));
    channel.assertQueue(name, options).then(
      () => finish(null),
      (error: unknown) => finish(error instanceof Error ? error : new Error('Falha ao declarar a fila.')),
    );
  });
  if (!failure) {
    channel.removeAllListeners('error');
    await channel.close().catch(() => undefined);
    return false;
  }
  if (!failure.message.includes('PRECONDITION_FAILED')) {
    throw failure;
  }

  const repair = track(await connection.createChannel());
  await repair.deleteQueue(name);
  await repair.assertQueue(name, options);
  await repair.close();
  return true;
}

function track(channel: Channel): Channel {
  channel.on('error', () => undefined);
  return channel;
}
