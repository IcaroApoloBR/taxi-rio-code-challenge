import { Injectable, Logger } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { activeTraceParent } from '../http/tracing';
import { MysqlDatabase } from './mysql-database';
import { RideEventEnvelope } from './ride-event';
import { OutboxRepository } from './ride.repository';

interface OutboxRow extends RowDataPacket {
  id: string;
  event_type: RideEventEnvelope['eventType'];
  payload: RideEventEnvelope['payload'] | string;
  correlation_id: string | null;
  created_at: string;
  traceparent: string | null;
}

@Injectable()
export class MysqlOutboxRepository extends OutboxRepository {
  private readonly logger = new Logger(MysqlOutboxRepository.name);

  constructor(private readonly database: MysqlDatabase) {
    super();
  }

  async append(event: RideEventEnvelope): Promise<void> {
    await this.database.executor().query<ResultSetHeader>(
      `INSERT INTO outbox_events (
        id, aggregate_id, event_type, payload, correlation_id, created_at, published_at, attempts, traceparent
      ) VALUES (?, ?, ?, CAST(? AS JSON), ?, ?, NULL, 0, ?)`,
      [
        event.eventId,
        event.payload.rideId,
        event.eventType,
        JSON.stringify(event.payload),
        event.correlationId,
        event.occurredAt,
        activeTraceParent(),
      ],
    );
  }

  async publishPending(publish: (event: RideEventEnvelope) => Promise<void>): Promise<number> {
    const connection = await this.database.pool.getConnection();
    let published = 0;
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<OutboxRow[]>(
        `SELECT id, event_type, payload, correlation_id, created_at, traceparent
         FROM outbox_events
         WHERE published_at IS NULL
         ORDER BY created_at
         LIMIT 20
         FOR UPDATE SKIP LOCKED`,
      );
      for (const row of rows) {
        const event = toEnvelope(row);
        try {
          await publish(event);
          await connection.query<ResultSetHeader>(
            'UPDATE outbox_events SET published_at = ?, attempts = attempts + 1 WHERE id = ?',
            [new Date().toISOString(), event.eventId],
          );
          published += 1;
        } catch (error) {
          await connection.query<ResultSetHeader>('UPDATE outbox_events SET attempts = attempts + 1 WHERE id = ?', [event.eventId]);
          this.logger.warn(`Falha ao publicar ${event.eventId}: ${error instanceof Error ? error.message : 'erro'}`);
        }
      }
      await connection.commit();
      return published;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async oldestPendingAgeSeconds(): Promise<number> {
    const [rows] = await this.database.pool.query<OutboxRow[]>(
      `SELECT created_at FROM outbox_events WHERE published_at IS NULL ORDER BY created_at ASC LIMIT 1`,
    );
    const createdAt = rows[0]?.created_at;
    if (!createdAt) return 0;
    const created = Date.parse(createdAt);
    if (Number.isNaN(created)) return 0;
    return Math.max(0, (Date.now() - created) / 1000);
  }
}

function toEnvelope(row: OutboxRow): RideEventEnvelope {
  const payload = typeof row.payload === 'string' ? (JSON.parse(row.payload) as RideEventEnvelope['payload']) : row.payload;
  return {
    eventId: row.id,
    eventType: row.event_type,
    occurredAt: row.created_at,
    correlationId: row.correlation_id,
    schemaVersion: 1,
    traceParent: row.traceparent,
    payload,
  };
}
