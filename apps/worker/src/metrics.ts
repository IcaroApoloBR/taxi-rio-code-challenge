import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics({ register, prefix: 'corridas_worker_' });

export const eventsProcessed = new Counter({
  name: 'worker_events_processed_total',
  help: 'Eventos de corrida confirmados pelo worker.',
  labelNames: ['event_type', 'result'] as const,
  registers: [register],
});

export const eventsFailed = new Counter({
  name: 'worker_events_failed_total',
  help: 'Eventos de corrida que falharam, foram para retry ou para a DLQ.',
  labelNames: ['event_type', 'result'] as const,
  registers: [register],
});

export const eventDuration = new Histogram({
  name: 'worker_event_processing_duration_seconds',
  help: 'Duração do processamento de um evento no worker.',
  labelNames: ['event_type'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export { register };
