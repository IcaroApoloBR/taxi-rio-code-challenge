import { randomUUID } from 'node:crypto';
import { Ride } from './ride';

export const rideCreatedEventType = 'corrida.criada';
export const rideStatusChangedEventType = 'corrida.status_alterado';

export interface RideCreatedPayload {
  rideId: string;
  passengerId: string;
  status: Ride['status'];
  createdAt: string;
}

export interface RideStatusChangedPayload {
  rideId: string;
  passengerId: string;
  driverId: string | null;
  previousStatus: Ride['status'];
  status: Ride['status'];
  version: number;
  updatedAt: string;
}

export interface RideEventEnvelope {
  eventId: string;
  eventType: typeof rideCreatedEventType | typeof rideStatusChangedEventType;
  occurredAt: string;
  correlationId: string | null;
  schemaVersion: 1;
  traceParent: string | null;
  payload: RideCreatedPayload | RideStatusChangedPayload;
}

export function rideCreatedEvent(ride: Ride, correlationId: string | null): RideEventEnvelope {
  return {
    eventId: randomUUID(),
    eventType: rideCreatedEventType,
    occurredAt: ride.createdAt,
    correlationId,
    schemaVersion: 1,
    traceParent: null,
    payload: {
      rideId: ride.id,
      passengerId: ride.passengerId,
      status: ride.status,
      createdAt: ride.createdAt,
    },
  };
}

export function rideStatusChangedEvent(previous: Ride, next: Ride, correlationId: string | null): RideEventEnvelope {
  return {
    eventId: randomUUID(),
    eventType: rideStatusChangedEventType,
    occurredAt: next.updatedAt,
    correlationId,
    schemaVersion: 1,
    traceParent: null,
    payload: {
      rideId: next.id,
      passengerId: next.passengerId,
      driverId: next.driverId,
      previousStatus: previous.status,
      status: next.status,
      version: next.version,
      updatedAt: next.updatedAt,
    },
  };
}
