import { RideEventEnvelope } from './ride-event';
import { Ride } from './ride';

export interface IdempotencyRecord {
  actorId: string;
  key: string;
  requestHash: string;
  body: Ride;
}

export abstract class RideRepository {
  abstract insert(ride: Ride): Promise<void>;
  abstract findById(id: string): Promise<Ride | null>;
  abstract listByPassenger(passengerId: string): Promise<Ride[]>;
  abstract listOpen(): Promise<Ride[]>;
  abstract findActiveByDriver(driverId: string): Promise<Ride | null>;
  abstract replace(ride: Ride, expectedVersion: number): Promise<boolean>;
}

export abstract class IdempotencyRepository {
  abstract find(actorId: string, key: string): Promise<IdempotencyRecord | null>;
  abstract insert(record: IdempotencyRecord): Promise<boolean>;
}

export abstract class RideUnitOfWork {
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}

export abstract class OutboxRepository {
  abstract append(event: RideEventEnvelope): Promise<void>;
  abstract publishPending(publish: (event: RideEventEnvelope) => Promise<void>): Promise<number>;
  abstract oldestPendingAgeSeconds(): Promise<number>;
}
