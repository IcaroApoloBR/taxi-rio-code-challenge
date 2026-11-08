export const paymentMethods = ['credit_card', 'debit_card', 'cash'] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export const discountPercents = [0, 10, 20, 30, 40] as const;

export type DiscountPercent = (typeof discountPercents)[number];

export interface QuoteOption {
  discountPercent: DiscountPercent;
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

interface KnownRoute {
  pickup: string;
  destination: string;
  distanceKm: number;
  durationMin: number;
  fareFlag: 1 | 2;
  baseCents: number;
  options?: QuoteOption[];
}

const knownRoutes: KnownRoute[] = [
  {
    pickup: 'av. maracana, 14',
    destination: 'conselheiro olegario',
    distanceKm: 2.1,
    durationMin: 7,
    fareFlag: 2,
    baseCents: 969,
  },
  {
    pickup: 'maracana',
    destination: 'sambodromo',
    distanceKm: 3.7,
    durationMin: 6,
    fareFlag: 2,
    baseCents: 2200,
    options: [0, 10, 20, 30, 40].map((discountPercent, index) => ({
      discountPercent: discountPercent as DiscountPercent,
      amountCents: 2200 - index * 200,
      driversAvailable: 1,
    })),
  },
];

export function quoteRide(pickup: string, destination: string): RideQuote {
  const from = fold(pickup);
  const to = fold(destination);
  const known = knownRoutes.find((route) => from.includes(route.pickup) && to.includes(route.destination));
  const base = known ?? fallbackRoute(from, to);
  return {
    distanceKm: base.distanceKm,
    durationMin: base.durationMin,
    fareFlag: base.fareFlag,
    baseCents: base.baseCents,
    options: base.options ?? discountPercents.map((discountPercent) => ({
      discountPercent,
      amountCents: Math.round((base.baseCents * (100 - discountPercent)) / 100),
      driversAvailable: 1,
    })),
  };
}

export function isDiscountPercent(value: number): value is DiscountPercent {
  return discountPercents.some((item) => item === value);
}

function fallbackRoute(pickup: string, destination: string): KnownRoute {
  const hash = [...`${pickup}|${destination}`].reduce((sum, char) => (sum + char.charCodeAt(0)) % 97, 0);
  const distanceKm = Math.round((12 + (hash % 40)) * 10) / 100;
  return {
    pickup,
    destination,
    distanceKm,
    durationMin: Math.max(4, Math.round(distanceKm * 1.7)),
    fareFlag: hash % 2 === 0 ? 2 : 1,
    baseCents: 800 + Math.round(distanceKm * 380),
  };
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}
