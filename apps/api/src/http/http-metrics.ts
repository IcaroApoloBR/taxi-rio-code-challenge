import { Counter, Gauge, Histogram, register } from 'prom-client';

export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Requisições HTTP recebidas pela API.',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP.',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Respostas HTTP 5xx da API.',
  labelNames: ['method', 'route'] as const,
  registers: [register],
});

export const oldestMessageAge = new Gauge({
  name: 'corridas_oldest_message_age_seconds',
  help: 'Idade em segundos do evento de outbox ainda não publicado. Zero quando não há pendência.',
  registers: [register],
});

export function setOldestMessageAge(seconds: number): void {
  oldestMessageAge.set(Math.max(0, seconds));
}
