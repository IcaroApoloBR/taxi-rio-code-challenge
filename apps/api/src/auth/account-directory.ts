import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ActorRole } from './auth-user';
import { InvalidCredentialsError } from './invalid-credentials.error';

export interface ActorProfile {
  sub: string;
  role: ActorRole;
  displayName: string;
  email: string | null;
  phone: string | null;
  ratr: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  rating: number | null;
}

interface PassengerRecord {
  email: string;
  phoneDigits: string;
  profile: ActorProfile;
}

interface DriverRecord {
  ratr: string;
  password: string;
  profile: ActorProfile;
}

export interface DemoCatalog {
  passengers: Array<{ name: string; email: string; phone: string }>;
  drivers: Array<{ name: string; ratr: string; password: string; vehicle: string; plate: string }>;
}

@Injectable()
export class AccountDirectory {
  private readonly passengers = new Map<string, PassengerRecord>();
  private readonly drivers = new Map<string, DriverRecord>();
  private readonly bySub = new Map<string, ActorProfile>();
  private readonly demoPassengerEmails = new Set<string>();

  constructor() {
    this.seed();
  }

  findBySub(sub: string): ActorProfile | null {
    return this.bySub.get(sub) ?? null;
  }

  loginPassenger(email: string, phone: string): ActorProfile {
    const normalizedEmail = email.trim().toLowerCase();
    const phoneDigits = normalizePhone(phone);
    const existing = this.passengers.get(normalizedEmail);
    if (existing) {
      if (!sameSecret(existing.phoneDigits, phoneDigits)) {
        throw new InvalidCredentialsError();
      }
      return existing.profile;
    }
    return this.registerPassenger(normalizedEmail, phoneDigits);
  }

  loginDriver(ratr: string, password: string): ActorProfile {
    const record = this.drivers.get(ratr.trim());
    if (!record || !sameSecret(record.password, password)) {
      throw new InvalidCredentialsError();
    }
    return record.profile;
  }

  demoCatalog(): DemoCatalog {
    return {
      passengers: [...this.passengers.values()]
        .filter((record) => this.demoPassengerEmails.has(record.email))
        .map((record) => ({
          name: record.profile.displayName,
          email: record.email,
          phone: record.profile.phone ?? formatPhone(record.phoneDigits),
        })),
      drivers: [...this.drivers.values()].map((record) => ({
        name: record.profile.displayName,
        ratr: record.ratr,
        password: record.password,
        vehicle: record.profile.vehicleModel ?? '',
        plate: record.profile.vehiclePlate ?? '',
      })),
    };
  }

  private registerPassenger(email: string, phoneDigits: string): ActorProfile {
    const profile: ActorProfile = {
      sub: `passenger-${randomUUID()}`,
      role: 'passenger',
      displayName: nameFromEmail(email),
      email,
      phone: formatPhone(phoneDigits),
      ratr: null,
      vehicleModel: null,
      vehiclePlate: null,
      rating: null,
    };
    this.passengers.set(email, { email, phoneDigits, profile });
    this.bySub.set(profile.sub, profile);
    return profile;
  }

  private seed(): void {
    this.addPassenger({
      sub: 'passenger-a',
      role: 'passenger',
      displayName: 'Ana P.',
      email: 'ana@demo.taxi.rio',
      phone: '(21) 98888-1001',
      ratr: null,
      vehicleModel: null,
      vehiclePlate: null,
      rating: null,
    });
    this.addPassenger({
      sub: 'passenger-b',
      role: 'passenger',
      displayName: 'Bruno C.',
      email: 'bruno@demo.taxi.rio',
      phone: '(21) 98888-1002',
      ratr: null,
      vehicleModel: null,
      vehiclePlate: null,
      rating: null,
    });
    this.addDriver(
      {
        sub: 'driver-a',
        role: 'driver',
        displayName: 'Manuel B. Filho',
        email: null,
        phone: null,
        ratr: '100001',
        vehicleModel: 'Chevrolet ONIX',
        vehiclePlate: 'KYZ-2356',
        rating: 4.5,
      },
      'demo-livre',
    );
    this.addDriver(
      {
        sub: 'driver-b',
        role: 'driver',
        displayName: 'Taxista 0.',
        email: null,
        phone: null,
        ratr: '100002',
        vehicleModel: 'PRISMA',
        vehiclePlate: 'KWU-8849',
        rating: 5,
      },
      'demo-livre',
    );
  }

  private addPassenger(profile: ActorProfile): void {
    const email = profile.email ?? '';
    this.demoPassengerEmails.add(email);
    this.passengers.set(email, { email, phoneDigits: normalizePhone(profile.phone ?? ''), profile });
    this.bySub.set(profile.sub, profile);
  }

  private addDriver(profile: ActorProfile, password: string): void {
    this.drivers.set(profile.ratr ?? '', { ratr: profile.ratr ?? '', password, profile });
    this.bySub.set(profile.sub, profile);
  }
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Passageiro';
  const parts = local.split(/[._-]+/).filter((part) => part.length > 0);
  const first = capitalize(parts[0] ?? 'Passageiro');
  const initial = parts[1]?.[0]?.toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function sameSecret(left: string, right: string): boolean {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}
