import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RideStatus, rideStatuses } from './ride';

export const statusCacheTtlSeconds = 300;

export interface RideStatusProjection {
  rideId: string;
  passengerId: string;
  driverId: string | null;
  status: RideStatus;
  version: number;
  updatedAt: string;
}

export function rideStatusKey(rideId: string): string {
  return `ride:${rideId}:status`;
}

const writeIfNewerScript = `
local current = redis.call('GET', KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if ok and type(decoded) == 'table' and tonumber(decoded['version']) and tonumber(decoded['version']) >= tonumber(ARGV[1]) then
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1
`;

export abstract class RideStatusCache {
  abstract read(rideId: string): Promise<RideStatusProjection | null>;
  abstract writeIfNewer(projection: RideStatusProjection): Promise<boolean>;
}

@Injectable()
export class MemoryRideStatusCache extends RideStatusCache {
  private readonly values = new Map<string, RideStatusProjection>();

  async read(rideId: string): Promise<RideStatusProjection | null> {
    const value = this.values.get(rideId);
    return value ? { ...value } : null;
  }

  async writeIfNewer(projection: RideStatusProjection): Promise<boolean> {
    const current = this.values.get(projection.rideId);
    if (current && current.version >= projection.version) {
      return false;
    }
    this.values.set(projection.rideId, { ...projection });
    return true;
  }
}

@Injectable()
export class RedisRideStatusCache extends RideStatusCache implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisRideStatusCache.name);
  private readonly redis: Redis;

  constructor() {
    super();
    const host = process.env.REDIS_HOST;
    if (!host) {
      throw new Error('REDIS_HOST é obrigatório para a projeção de status.');
    }
    this.redis = new Redis({
      host,
      port: numberSetting('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    this.redis.on('error', (error: Error) => {
      this.logger.warn(`Redis: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async read(rideId: string): Promise<RideStatusProjection | null> {
    const raw = await this.redis.get(rideStatusKey(rideId));
    if (!raw) return null;
    return parseProjection(raw);
  }

  async writeIfNewer(projection: RideStatusProjection): Promise<boolean> {
    const written = await this.redis.eval(
      writeIfNewerScript,
      1,
      rideStatusKey(projection.rideId),
      String(projection.version),
      JSON.stringify(projection),
      String(statusCacheTtlSeconds),
    );
    return written === 1;
  }
}

function parseProjection(raw: string): RideStatusProjection | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const projection = value as Partial<RideStatusProjection>;
    if (typeof projection.rideId !== 'string' || typeof projection.passengerId !== 'string') return null;
    if (typeof projection.updatedAt !== 'string' || typeof projection.version !== 'number') return null;
    if (!isRideStatus(projection.status)) return null;
    if (projection.driverId !== null && typeof projection.driverId !== 'string') return null;
    return {
      rideId: projection.rideId,
      passengerId: projection.passengerId,
      driverId: projection.driverId ?? null,
      status: projection.status,
      version: projection.version,
      updatedAt: projection.updatedAt,
    };
  } catch {
    return null;
  }
}

function isRideStatus(value: unknown): value is RideStatus {
  return typeof value === 'string' && rideStatuses.includes(value as RideStatus);
}

function numberSetting(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variável ${name} precisa ser uma porta válida.`);
  }
  return parsed;
}
