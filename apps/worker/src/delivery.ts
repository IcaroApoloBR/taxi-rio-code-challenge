import { ConsumeMessage } from 'amqplib';

export const maxDeliveries = 3;

export function deathCount(message: ConsumeMessage, queue: string): number {
  const deaths = message.properties.headers?.['x-death'];
  if (!Array.isArray(deaths)) return 0;
  return deaths.reduce((sum: number, entry: unknown) => {
    if (!entry || typeof entry !== 'object') return sum;
    const death = entry as { queue?: unknown; count?: unknown };
    if (death.queue !== queue || typeof death.count !== 'number') return sum;
    return sum + death.count;
  }, 0);
}
