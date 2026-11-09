import { DiscountPercent, PaymentMethod } from './quote';

export const rideStatuses = ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export type RideStatus = (typeof rideStatuses)[number];

export interface Ride {
  id: string;
  passengerId: string;
  passengerName: string;
  driverId: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  driverRating: number | null;
  status: RideStatus;
  pickup: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  fareFlag: 1 | 2;
  discountPercent: DiscountPercent;
  paymentMethod: PaymentMethod;
  baseCents: number;
  amountCents: number;
  ratingScore: number | null;
  ratingComment: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const nextStatus: Record<RideStatus, RideStatus | null> = {
  REQUESTED: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
};

export class RideConflictError extends Error {
  readonly code: string;

  constructor(message = 'A corrida não pode avançar a partir do status atual.', code = 'RIDE_STATUS_CONFLICT') {
    super(message);
    this.code = code;
  }
}

export class RideNotFoundError extends Error {
  constructor(message = 'Corrida não encontrada.') {
    super(message);
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('A chave de idempotência já foi usada com outro payload.');
  }
}

export class IdempotencyRaceError extends Error {
  constructor() {
    super('A chave de idempotência foi gravada por outra requisição.');
  }
}

export function assertTransition(current: RideStatus, next: RideStatus): void {
  if (nextStatus[current] !== next) {
    throw new RideConflictError();
  }
}
