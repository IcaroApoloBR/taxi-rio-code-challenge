import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPool, Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { withSpan } from '../http/tracing';

const schema = [
  `CREATE TABLE IF NOT EXISTS rides (
    id CHAR(36) NOT NULL,
    passenger_id VARCHAR(80) NOT NULL,
    passenger_name VARCHAR(120) NOT NULL,
    driver_id VARCHAR(80) NULL,
    driver_name VARCHAR(120) NULL,
    vehicle_model VARCHAR(80) NULL,
    vehicle_plate VARCHAR(16) NULL,
    driver_rating DECIMAL(2,1) NULL,
    status VARCHAR(20) NOT NULL,
    pickup VARCHAR(200) NOT NULL,
    destination VARCHAR(200) NOT NULL,
    distance_km DECIMAL(6,2) NOT NULL,
    duration_min INT NOT NULL,
    fare_flag TINYINT NOT NULL,
    discount_percent TINYINT NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    base_cents INT NOT NULL,
    amount_cents INT NOT NULL,
    rating_score TINYINT NULL,
    rating_comment VARCHAR(280) NULL,
    version INT NOT NULL,
    active_driver_id VARCHAR(80) NULL,
    created_at VARCHAR(32) NOT NULL,
    updated_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY rides_one_active_driver (active_driver_id),
    KEY rides_passenger_created (passenger_id, created_at),
    KEY rides_status_created (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS idempotency_records (
    actor_id VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    response_body JSON NOT NULL,
    created_at VARCHAR(32) NOT NULL,
    PRIMARY KEY (actor_id, idempotency_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS outbox_events (
    id CHAR(36) NOT NULL,
    aggregate_id CHAR(36) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    correlation_id VARCHAR(100) NULL,
    created_at VARCHAR(32) NOT NULL,
    published_at VARCHAR(32) NULL,
    attempts INT NOT NULL,
    traceparent VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY outbox_pending (published_at, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

@Injectable()
export class MysqlDatabase implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;
  private readonly current = new AsyncLocalStorage<PoolConnection>();

  constructor() {
    this.pool = createPool({
      host: required('MYSQL_HOST'),
      port: numberSetting('MYSQL_PORT', 3306),
      user: required('MYSQL_USER'),
      password: required('MYSQL_PASSWORD'),
      database: required('MYSQL_DATABASE'),
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      timezone: 'Z',
    });
  }

  executor(): Pool | PoolConnection {
    return this.current.getStore() ?? this.pool;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.current.getStore()) {
      return work();
    }
    const connection = await this.pool.getConnection();
    try {
      return await withSpan('mysql ride transaction', {}, async () => {
        await connection.beginTransaction();
        const result = await this.current.run(connection, work);
        await connection.commit();
        return result;
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async onModuleInit(): Promise<void> {
    for (const statement of schema) {
      await this.pool.query(statement);
    }
    const [columns] = await this.pool.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME AS column_name
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'outbox_events' AND COLUMN_NAME = 'traceparent'`,
    );
    if (columns.length === 0) {
      await this.pool.query('ALTER TABLE outbox_events ADD COLUMN traceparent VARCHAR(255) NULL');
    }
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável ${name} é obrigatória quando MYSQL_HOST está definido.`);
  }
  return value;
}

function numberSetting(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Variável ${name} precisa ser uma porta válida.`);
  }
  return parsed;
}
