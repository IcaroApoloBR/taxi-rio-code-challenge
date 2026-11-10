import assert from 'node:assert/strict';
import test from 'node:test';
import { Channel, ConsumeMessage } from 'amqplib';
import { handleDelivery } from './consume.js';
import { acceptsNewerVersion } from './version.js';
import { writeIfNewerScript } from './projection.js';

const created = JSON.stringify({
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'corrida.criada',
  occurredAt: '2026-11-10T12:00:00.000Z',
  correlationId: 'corr',
  schemaVersion: 1,
  payload: {
    rideId: '22222222-2222-4222-8222-222222222222',
    passengerId: 'passenger-a',
    status: 'REQUESTED',
    createdAt: '2026-11-10T12:00:00.000Z',
  },
});

function delivery(body: string, headers: Record<string, unknown> = {}): ConsumeMessage {
  return {
    content: Buffer.from(body),
    fields: { deliveryTag: 1, redelivered: false, exchange: 'corridas.events', routingKey: 'corrida.criada' },
    properties: { headers, contentType: 'application/json', messageId: 'm', correlationId: 'c' },
  } as ConsumeMessage;
}

function fakeChannel(): { ops: string[]; channel: Channel } {
  const ops: string[] = [];
  const channel = {
    ack: () => ops.push('ack'),
    nack: (_message: ConsumeMessage, _allUpTo: boolean, requeue: boolean) => ops.push(`nack:${String(requeue)}`),
    publish: () => {
      ops.push('publish');
      return true;
    },
  };
  return { ops, channel: channel as unknown as Channel };
}

test('a handler failure is not acknowledged', async () => {
  const { ops, channel } = fakeChannel();
  await handleDelivery(channel, 'corridas.history', delivery(created), async () => {
    throw new Error('mongo down');
  }, () => false);
  assert.deepEqual(ops, ['nack:false']);
});

test('invalid JSON is acknowledged only after the dead-letter publish', async () => {
  const { ops, channel } = fakeChannel();
  await handleDelivery(channel, 'corridas.history', delivery('not-json'), async () => 'processed', () => false);
  assert.deepEqual(ops, ['publish', 'ack']);
});

test('the fourth delivery of the same queue goes to the dead-letter queue without the handler', async () => {
  const { ops, channel } = fakeChannel();
  let handled = false;
  await handleDelivery(
    channel,
    'corridas.history',
    delivery(created, { 'x-death': [{ queue: 'corridas.history', count: 3 }] }),
    async () => {
      handled = true;
      return 'processed';
    },
    () => false,
  );
  assert.equal(handled, false);
  assert.deepEqual(ops, ['publish', 'ack']);
});

test('a processed event is acknowledged once', async () => {
  const { ops, channel } = fakeChannel();
  await handleDelivery(channel, 'corridas.history', delivery(created), async () => 'processed', () => false);
  assert.deepEqual(ops, ['ack']);
});

test('the Redis script keeps the stored version when the incoming one is not newer', () => {
  assert.match(writeIfNewerScript, /tonumber\(decoded\['version'\]\) >= tonumber\(ARGV\[1\]\)/);
  assert.equal(acceptsNewerVersion(2, 1), false);
});
