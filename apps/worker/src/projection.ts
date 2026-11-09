import { Redis } from 'ioredis';
import { InvalidRideEvent, RideEvent } from './event.js';

export const statusCacheTtlSeconds = 300;

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

export class StatusProjection {
  constructor(private readonly redis: Redis) {}

  async write(event: RideEvent): Promise<'processed' | 'duplicate'> {
    if (event.eventType !== 'corrida.status_alterado' || typeof event.payload.version !== 'number' || typeof event.payload.updatedAt !== 'string') {
      throw new InvalidRideEvent('Evento sem projeção de status.');
    }
    const projection = {
      rideId: event.payload.rideId,
      passengerId: event.payload.passengerId,
      driverId: event.payload.driverId ?? null,
      status: event.payload.status,
      version: event.payload.version,
      updatedAt: event.payload.updatedAt,
    };
    const written = await this.redis.eval(
      writeIfNewerScript,
      1,
      `ride:${projection.rideId}:status`,
      String(projection.version),
      JSON.stringify(projection),
      String(statusCacheTtlSeconds),
    );
    return written === 1 ? 'processed' : 'duplicate';
  }
}
