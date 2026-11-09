export class InvalidRideEvent extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRideEvent';
  }
}

export interface RideEvent {
  eventId: string;
  eventType: 'corrida.criada' | 'corrida.status_alterado';
  occurredAt: string;
  correlationId: string | null;
  schemaVersion: 1;
  payload: {
    rideId: string;
    passengerId: string;
    status: string;
    driverId?: string | null;
    previousStatus?: string;
    version?: number;
    updatedAt?: string;
    createdAt?: string;
  };
}

export function parseRideEvent(raw: string): RideEvent {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new InvalidRideEvent('JSON inválido.');
  }
  if (!value || typeof value !== 'object') {
    throw new InvalidRideEvent('Envelope inválido.');
  }
  const event = value as Record<string, unknown>;
  if (typeof event.eventId !== 'string' || event.eventId.length === 0) {
    throw new InvalidRideEvent('eventId ausente.');
  }
  if (event.eventType !== 'corrida.criada' && event.eventType !== 'corrida.status_alterado') {
    throw new InvalidRideEvent('eventType desconhecido.');
  }
  if (typeof event.occurredAt !== 'string') {
    throw new InvalidRideEvent('occurredAt ausente.');
  }
  if (event.schemaVersion !== 1) {
    throw new InvalidRideEvent('schemaVersion não suportada.');
  }
  if (event.correlationId !== null && typeof event.correlationId !== 'string') {
    throw new InvalidRideEvent('correlationId inválido.');
  }
  if (!event.payload || typeof event.payload !== 'object') {
    throw new InvalidRideEvent('payload ausente.');
  }
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.rideId !== 'string' || typeof payload.passengerId !== 'string' || typeof payload.status !== 'string') {
    throw new InvalidRideEvent('payload incompleto.');
  }
  if (event.eventType === 'corrida.status_alterado') {
    if (typeof payload.version !== 'number' || !Number.isInteger(payload.version)) {
      throw new InvalidRideEvent('version ausente.');
    }
    if (typeof payload.updatedAt !== 'string' || typeof payload.previousStatus !== 'string') {
      throw new InvalidRideEvent('status alterado incompleto.');
    }
    if (payload.driverId !== null && typeof payload.driverId !== 'string') {
      throw new InvalidRideEvent('driverId inválido.');
    }
  }
  return event as unknown as RideEvent;
}
