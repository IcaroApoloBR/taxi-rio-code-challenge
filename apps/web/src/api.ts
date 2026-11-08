import { PaymentMethod, Profile, Ride, RideQuote, RideStatus, Session } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function explain(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return `Não foi possível conectar à API em ${apiBaseUrl}.`;
}

export async function loginPassenger(email: string, phone: string): Promise<Session> {
  return login({ role: 'passenger', email, phone });
}

export async function loginDriver(ratr: string, password: string): Promise<Session> {
  return login({ role: 'driver', ratr, password });
}

export function quoteRide(token: string, pickup: string, destination: string): Promise<RideQuote> {
  return request<RideQuote>('/api/corridas/cotacao', token, {
    method: 'POST',
    body: JSON.stringify({ pickup, destination }),
  });
}

export function createRide(
  token: string,
  input: { pickup: string; destination: string; discountPercent: number; paymentMethod: PaymentMethod },
): Promise<Ride> {
  return request<Ride>('/api/corridas', token, {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}

export function listRides(token: string): Promise<Ride[]> {
  return request<Ride[]>('/api/corridas', token);
}

export function loadRide(token: string, id: string): Promise<Ride> {
  return request<Ride>(`/api/corridas/${id}`, token);
}

export function listAvailable(token: string): Promise<Ride[]> {
  return request<Ride[]>('/api/corridas/disponiveis', token);
}

export async function loadAssigned(token: string): Promise<Ride | null> {
  try {
    return await request<Ride>('/api/corridas/atribuida', token);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function advanceRide(token: string, id: string, status: RideStatus): Promise<Ride> {
  return request<Ride>(`/api/corridas/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function cancelRide(token: string, id: string): Promise<Ride> {
  return request<Ride>(`/api/corridas/${id}/cancel`, token, { method: 'POST' });
}

export function rateRide(token: string, id: string, score: number, comment: string): Promise<Ride> {
  return request<Ride>(`/api/corridas/${id}/avaliacao`, token, {
    method: 'POST',
    body: JSON.stringify({ score, comment: comment.trim() || undefined }),
  });
}

async function login(body: Record<string, string>): Promise<Session> {
  const response = await request<{ accessToken: string; profile: Profile }>('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { accessToken: response.accessToken, profile: response.profile };
}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Não foi possível conectar à API em ${apiBaseUrl}.`, 0);
  }
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    throw new ApiError(body.message ?? 'A API recusou a operação.', response.status);
  }
  return body as T;
}
