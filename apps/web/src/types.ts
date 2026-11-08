export type Role = 'passenger' | 'driver';

export type RideStatus = 'REQUESTED' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type PaymentMethod = 'credit_card' | 'debit_card' | 'cash';

export interface Profile {
  sub: string;
  role: Role;
  displayName: string;
  email: string | null;
  phone: string | null;
  ratr: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  rating: number | null;
}

export interface Session {
  accessToken: string;
  profile: Profile;
}

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
  discountPercent: number;
  paymentMethod: PaymentMethod;
  baseCents: number;
  amountCents: number;
  ratingScore: number | null;
  ratingComment: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteOption {
  discountPercent: number;
  amountCents: number;
  driversAvailable: number;
}

export interface RideQuote {
  distanceKm: number;
  durationMin: number;
  fareFlag: 1 | 2;
  baseCents: number;
  options: QuoteOption[];
}
