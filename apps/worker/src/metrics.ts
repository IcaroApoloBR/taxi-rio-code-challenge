import { collectDefaultMetrics, Counter, register } from 'prom-client';

collectDefaultMetrics({ register, prefix: 'corridas_worker_' });

export const eventsTotal = new Counter({
  name: 'corridas_worker_events_total',
  help: 'Eventos de corrida consumidos pelo worker.',
  labelNames: ['queue', 'result'] as const,
  registers: [register],
});

export { register };
