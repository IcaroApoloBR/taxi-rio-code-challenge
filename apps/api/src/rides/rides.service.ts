import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AccountDirectory } from '../auth/account-directory';
import { AuthUser } from '../auth/auth-user';
import { DiscountPercent, isDiscountPercent, PaymentMethod, quoteRide, RideQuote } from './quote';
import { rideCreatedEvent, rideStatusChangedEvent } from './ride-event';
import { IdempotencyRepository, OutboxRepository, RideRepository, RideUnitOfWork } from './ride.repository';
import {
  assertTransition,
  IdempotencyConflictError,
  IdempotencyRaceError,
  Ride,
  RideConflictError,
  RideNotFoundError,
  RideStatus,
} from './ride';
import { RideStatusCache, RideStatusProjection } from './status-cache';

export interface CreateRideInput {
  pickup: string;
  destination: string;
  discountPercent?: number;
  paymentMethod?: PaymentMethod;
}

export interface RateRideInput {
  score: number;
  comment?: string;
}

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly rides: RideRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly accounts: AccountDirectory,
    private readonly unit: RideUnitOfWork,
    private readonly outbox: OutboxRepository,
    private readonly statusCache: RideStatusCache,
  ) {}

  quote(input: { pickup: string; destination: string }): RideQuote {
    return quoteRide(input.pickup, input.destination);
  }

  create(passengerId: string, idempotencyKey: string, input: CreateRideInput, correlationId: string | null): Promise<Ride> {
    const normalized = normalizeCreate(input);
    return this.serialized(async () => {
      try {
        return await this.unit.run(() => this.createExclusive(passengerId, idempotencyKey, normalized, correlationId));
      } catch (error) {
        if (!(error instanceof IdempotencyRaceError)) {
          throw error;
        }
        return this.replay(passengerId, idempotencyKey, normalized);
      }
    });
  }

  list(passengerId: string): Promise<Ride[]> {
    return this.rides.listByPassenger(passengerId);
  }

  listAvailable(): Promise<Ride[]> {
    return this.rides.listOpen();
  }

  async findForPassenger(passengerId: string, rideId: string): Promise<Ride> {
    const ride = await this.readOwned(passengerId, rideId);
    return this.withFreshProjection(ride);
  }

  async findAssigned(driverId: string): Promise<Ride> {
    const ride = await this.rides.findActiveByDriver(driverId);
    if (!ride) {
      throw new RideNotFoundError('Nenhuma corrida atribuída a este motorista.');
    }
    return ride;
  }

  changeStatus(driverId: string, rideId: string, status: RideStatus, correlationId: string | null): Promise<Ride> {
    return this.serialized(() => this.unit.run(() => this.changeStatusExclusive(driverId, rideId, status, correlationId)));
  }

  cancel(actor: AuthUser, rideId: string, correlationId: string | null): Promise<Ride> {
    return this.serialized(() => this.unit.run(() => this.cancelExclusive(actor, rideId, correlationId)));
  }

  rate(passengerId: string, rideId: string, input: RateRideInput): Promise<Ride> {
    return this.serialized(() => this.unit.run(() => this.rateExclusive(passengerId, rideId, input)));
  }

  private async createExclusive(
    passengerId: string,
    idempotencyKey: string,
    input: NormalizedCreate,
    correlationId: string | null,
  ): Promise<Ride> {
    const requestHash = hashRequest(input);
    const existing = await this.idempotency.find(passengerId, idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictError();
      }
      return existing.body;
    }

    const quote = quoteRide(input.pickup, input.destination);
    const option = quote.options.find((item) => item.discountPercent === input.discountPercent);
    if (!option) {
      throw new BadRequestException('Desconto inválido.');
    }
    const passenger = this.accounts.findBySub(passengerId);
    const now = new Date().toISOString();
    const ride: Ride = {
      id: randomUUID(),
      passengerId,
      passengerName: passenger?.displayName ?? passengerId,
      driverId: null,
      driverName: null,
      vehicleModel: null,
      vehiclePlate: null,
      driverRating: null,
      status: 'REQUESTED',
      pickup: input.pickup,
      destination: input.destination,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
      fareFlag: quote.fareFlag,
      discountPercent: input.discountPercent,
      paymentMethod: input.paymentMethod,
      baseCents: quote.baseCents,
      amountCents: option.amountCents,
      ratingScore: null,
      ratingComment: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await this.rides.insert(ride);
    const stored = await this.idempotency.insert({
      actorId: passengerId,
      key: idempotencyKey,
      requestHash,
      body: ride,
    });
    if (!stored) {
      throw new IdempotencyRaceError();
    }
    await this.outbox.append(rideCreatedEvent(ride, correlationId));
    return ride;
  }

  private async replay(passengerId: string, idempotencyKey: string, input: NormalizedCreate): Promise<Ride> {
    const existing = await this.idempotency.find(passengerId, idempotencyKey);
    if (!existing || existing.requestHash !== hashRequest(input)) {
      throw new IdempotencyConflictError();
    }
    return existing.body;
  }

  private async readOwned(passengerId: string, rideId: string): Promise<Ride> {
    const ride = await this.rides.findById(rideId);
    if (!ride || ride.passengerId !== passengerId) {
      throw new RideNotFoundError();
    }
    return ride;
  }

  private async changeStatusExclusive(
    driverId: string,
    rideId: string,
    status: RideStatus,
    correlationId: string | null,
  ): Promise<Ride> {
    const current = await this.rides.findById(rideId);
    if (!current) {
      throw new RideNotFoundError();
    }

    if (current.status === 'REQUESTED') {
      if (status !== 'ACCEPTED') {
        throw new RideConflictError();
      }
      const active = await this.rides.findActiveByDriver(driverId);
      if (active) {
        throw new RideConflictError('O motorista já está em outra corrida.', 'DRIVER_BUSY');
      }
      return this.save(current, this.accept(current, driverId), correlationId);
    }

    if (current.driverId !== driverId) {
      throw new RideConflictError();
    }
    assertTransition(current.status, status);
    return this.save(
      current,
      { ...current, status, version: current.version + 1, updatedAt: new Date().toISOString() },
      correlationId,
    );
  }

  private accept(current: Ride, driverId: string): Ride {
    const driver = this.accounts.findBySub(driverId);
    return {
      ...current,
      status: 'ACCEPTED',
      driverId,
      driverName: driver?.displayName ?? driverId,
      vehicleModel: driver?.vehicleModel ?? null,
      vehiclePlate: driver?.vehiclePlate ?? null,
      driverRating: driver?.rating ?? null,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
  }

  private async cancelExclusive(actor: AuthUser, rideId: string, correlationId: string | null): Promise<Ride> {
    const current = await this.rides.findById(rideId);
    if (!current) {
      throw new RideNotFoundError();
    }
    const allowed =
      actor.role === 'passenger'
        ? current.passengerId === actor.sub && (current.status === 'REQUESTED' || current.status === 'ACCEPTED')
        : current.driverId === actor.sub && current.status === 'ACCEPTED';
    if (actor.role === 'passenger' && current.passengerId !== actor.sub) {
      throw new RideNotFoundError();
    }
    if (actor.role === 'driver' && current.driverId !== actor.sub) {
      throw new RideNotFoundError();
    }
    if (!allowed) {
      throw new RideConflictError('A corrida não pode ser cancelada a partir do status atual.', 'RIDE_CANCEL_CONFLICT');
    }
    return this.save(
      current,
      {
        ...current,
        status: 'CANCELLED',
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      },
      correlationId,
    );
  }

  private async rateExclusive(passengerId: string, rideId: string, input: RateRideInput): Promise<Ride> {
    const current = await this.readOwned(passengerId, rideId);
    if (current.status !== 'COMPLETED') {
      throw new RideConflictError('A corrida só pode ser avaliada depois de concluída.', 'RIDE_RATING_CONFLICT');
    }
    if (current.ratingScore !== null) {
      throw new RideConflictError('A corrida já foi avaliada.', 'RIDE_ALREADY_RATED');
    }
    const comment = input.comment?.trim() ? input.comment.trim() : null;
    return this.save(
      current,
      {
        ...current,
        ratingScore: input.score,
        ratingComment: comment,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      },
      null,
    );
  }

  private async save(current: Ride, next: Ride, correlationId: string | null): Promise<Ride> {
    const saved = await this.rides.replace(next, current.version);
    if (!saved) {
      throw new RideConflictError();
    }
    if (current.status !== next.status) {
      await this.outbox.append(rideStatusChangedEvent(current, next, correlationId));
    }
    return next;
  }

  private async withFreshProjection(ride: Ride): Promise<Ride> {
    try {
      const cached = await this.statusCache.read(ride.id);
      if (!cached || cached.version < ride.version) {
        await this.statusCache.writeIfNewer(projectionOf(ride));
        return ride;
      }
      if (cached.version === ride.version) {
        return ride;
      }
      return {
        ...ride,
        status: cached.status,
        driverId: cached.driverId,
        version: cached.version,
        updatedAt: cached.updatedAt,
      };
    } catch (error) {
      this.logger.warn(`Projeção de status indisponível: ${error instanceof Error ? error.message : 'erro'}`);
      return ride;
    }
  }

  private serialized<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(work, work);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

interface NormalizedCreate {
  pickup: string;
  destination: string;
  discountPercent: DiscountPercent;
  paymentMethod: PaymentMethod;
}

function normalizeCreate(input: CreateRideInput): NormalizedCreate {
  const discountPercent = input.discountPercent ?? 0;
  if (!isDiscountPercent(discountPercent)) {
    throw new BadRequestException('Desconto inválido.');
  }
  return {
    pickup: input.pickup,
    destination: input.destination,
    discountPercent,
    paymentMethod: input.paymentMethod ?? 'credit_card',
  };
}

function projectionOf(ride: Ride): RideStatusProjection {
  return {
    rideId: ride.id,
    passengerId: ride.passengerId,
    driverId: ride.driverId,
    status: ride.status,
    version: ride.version,
    updatedAt: ride.updatedAt,
  };
}

function hashRequest(input: NormalizedCreate): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        destination: input.destination,
        discountPercent: input.discountPercent,
        paymentMethod: input.paymentMethod,
        pickup: input.pickup,
      }),
    )
    .digest('hex');
}
