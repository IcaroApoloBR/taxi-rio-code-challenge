import { Injectable } from '@nestjs/common';
import { RideEventEnvelope } from './ride-event';
import { IdempotencyRecord, IdempotencyRepository, OutboxRepository, RideRepository, RideUnitOfWork } from './ride.repository';
import { Ride } from './ride';

@Injectable()
export class MemoryRideRepository extends RideRepository {
  private readonly rides = new Map<string, Ride>();

  async insert(ride: Ride): Promise<void> {
    this.rides.set(ride.id, clone(ride));
  }

  async findById(id: string): Promise<Ride | null> {
    const ride = this.rides.get(id);
    return ride ? clone(ride) : null;
  }

  async listByPassenger(passengerId: string): Promise<Ride[]> {
    return [...this.rides.values()]
      .filter((ride) => ride.passengerId === passengerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  async listOpen(): Promise<Ride[]> {
    return [...this.rides.values()]
      .filter((ride) => ride.status === 'REQUESTED')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  async findActiveByDriver(driverId: string): Promise<Ride | null> {
    const active = [...this.rides.values()]
      .filter((ride) => ride.driverId === driverId && (ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS'))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return active[0] ? clone(active[0]) : null;
  }

  async replace(ride: Ride, expectedVersion: number): Promise<boolean> {
    const current = this.rides.get(ride.id);
    if (!current || current.version !== expectedVersion) {
      return false;
    }
    this.rides.set(ride.id, clone(ride));
    return true;
  }
}

@Injectable()
export class MemoryIdempotencyRepository extends IdempotencyRepository {
  private readonly records = new Map<string, IdempotencyRecord>();

  async find(actorId: string, key: string): Promise<IdempotencyRecord | null> {
    const record = this.records.get(storageKey(actorId, key));
    return record ? { ...record, body: clone(record.body) } : null;
  }

  async insert(record: IdempotencyRecord): Promise<boolean> {
    const key = storageKey(record.actorId, record.key);
    if (this.records.has(key)) {
      return false;
    }
    this.records.set(key, { ...record, body: clone(record.body) });
    return true;
  }
}

@Injectable()
export class MemoryRideUnitOfWork extends RideUnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

@Injectable()
export class MemoryOutboxRepository extends OutboxRepository {
  private readonly events: RideEventEnvelope[] = [];

  async append(event: RideEventEnvelope): Promise<void> {
    this.events.push(event);
  }

  async publishPending(): Promise<number> {
    return 0;
  }

  async oldestPendingAgeSeconds(): Promise<number> {
    return 0;
  }
}

function storageKey(actorId: string, key: string): string {
  return `${actorId}\u0000${key}`;
}

function clone(ride: Ride): Ride {
  return { ...ride };
}
