import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { MysqlDatabase } from './mysql-database';
import { DiscountPercent, PaymentMethod } from './quote';
import { Ride, RideConflictError } from './ride';
import { IdempotencyRecord, IdempotencyRepository, RideRepository, RideUnitOfWork } from './ride.repository';

interface RideRow extends RowDataPacket {
  id: string;
  passenger_id: string;
  passenger_name: string;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  driver_rating: number | null;
  status: Ride['status'];
  pickup: string;
  destination: string;
  distance_km: number;
  duration_min: number;
  fare_flag: 1 | 2;
  discount_percent: DiscountPercent;
  payment_method: PaymentMethod;
  base_cents: number;
  amount_cents: number;
  rating_score: number | null;
  rating_comment: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface IdempotencyRow extends RowDataPacket {
  actor_id: string;
  idempotency_key: string;
  request_hash: string;
  response_body: Ride | string;
}

const rideColumns = `id, passenger_id, passenger_name, driver_id, driver_name, vehicle_model, vehicle_plate,
  driver_rating, status, pickup, destination, distance_km, duration_min, fare_flag, discount_percent,
  payment_method, base_cents, amount_cents, rating_score, rating_comment, version, created_at, updated_at`;

@Injectable()
export class MysqlRideRepository extends RideRepository {
  constructor(private readonly database: MysqlDatabase) {
    super();
  }

  async insert(ride: Ride): Promise<void> {
    await this.database.executor().query(
      `INSERT INTO rides (
        id, passenger_id, passenger_name, driver_id, driver_name, vehicle_model, vehicle_plate,
        driver_rating, status, pickup, destination, distance_km, duration_min, fare_flag,
        discount_percent, payment_method, base_cents, amount_cents, rating_score, rating_comment,
        version, active_driver_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      rideValues(ride),
    );
  }

  async findById(id: string): Promise<Ride | null> {
    const [rows] = await this.database.executor().query<RideRow[]>(`SELECT ${rideColumns} FROM rides WHERE id = ?`, [id]);
    return rows[0] ? toRide(rows[0]) : null;
  }

  async listByPassenger(passengerId: string): Promise<Ride[]> {
    const [rows] = await this.database
      .executor()
      .query<RideRow[]>(`SELECT ${rideColumns} FROM rides WHERE passenger_id = ? ORDER BY created_at DESC`, [passengerId]);
    return rows.map(toRide);
  }

  async listOpen(): Promise<Ride[]> {
    const [rows] = await this.database
      .executor()
      .query<RideRow[]>(`SELECT ${rideColumns} FROM rides WHERE status = 'REQUESTED' ORDER BY created_at DESC`, []);
    return rows.map(toRide);
  }

  async findActiveByDriver(driverId: string): Promise<Ride | null> {
    const [rows] = await this.database.executor().query<RideRow[]>(
      `SELECT ${rideColumns} FROM rides
       WHERE active_driver_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [driverId],
    );
    return rows[0] ? toRide(rows[0]) : null;
  }

  async replace(ride: Ride, expectedVersion: number): Promise<boolean> {
    try {
      const [result] = await this.database.executor().query<ResultSetHeader>(
        `UPDATE rides SET
          passenger_id = ?, passenger_name = ?, driver_id = ?, driver_name = ?, vehicle_model = ?,
          vehicle_plate = ?, driver_rating = ?, status = ?, pickup = ?, destination = ?, distance_km = ?,
          duration_min = ?, fare_flag = ?, discount_percent = ?, payment_method = ?, base_cents = ?,
          amount_cents = ?, rating_score = ?, rating_comment = ?, version = ?, active_driver_id = ?,
          created_at = ?, updated_at = ?
        WHERE id = ? AND version = ?`,
        [...rideValues(ride).slice(1), ride.id, expectedVersion],
      );
      return result.affectedRows === 1;
    } catch (error) {
      if (isDuplicate(error)) {
        throw new RideConflictError('O motorista já está em outra corrida.', 'DRIVER_BUSY');
      }
      throw error;
    }
  }
}

@Injectable()
export class MysqlIdempotencyRepository extends IdempotencyRepository {
  constructor(private readonly database: MysqlDatabase) {
    super();
  }

  async find(actorId: string, key: string): Promise<IdempotencyRecord | null> {
    const [rows] = await this.database.executor().query<IdempotencyRow[]>(
      `SELECT actor_id, idempotency_key, request_hash, response_body
       FROM idempotency_records
       WHERE actor_id = ? AND idempotency_key = ?`,
      [actorId, key],
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      actorId: row.actor_id,
      key: row.idempotency_key,
      requestHash: row.request_hash,
      body: typeof row.response_body === 'string' ? (JSON.parse(row.response_body) as Ride) : row.response_body,
    };
  }

  async insert(record: IdempotencyRecord): Promise<boolean> {
    try {
      await this.database.executor().query(
        `INSERT INTO idempotency_records (actor_id, idempotency_key, request_hash, response_body, created_at)
         VALUES (?, ?, ?, CAST(? AS JSON), ?)`,
        [record.actorId, record.key, record.requestHash, JSON.stringify(record.body), new Date().toISOString()],
      );
      return true;
    } catch (error) {
      if (isDuplicate(error)) {
        return false;
      }
      throw error;
    }
  }
}

@Injectable()
export class MysqlRideUnitOfWork extends RideUnitOfWork {
  constructor(private readonly database: MysqlDatabase) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.database.run(work);
  }
}

function rideValues(ride: Ride): unknown[] {
  return [
    ride.id,
    ride.passengerId,
    ride.passengerName,
    ride.driverId,
    ride.driverName,
    ride.vehicleModel,
    ride.vehiclePlate,
    ride.driverRating,
    ride.status,
    ride.pickup,
    ride.destination,
    ride.distanceKm,
    ride.durationMin,
    ride.fareFlag,
    ride.discountPercent,
    ride.paymentMethod,
    ride.baseCents,
    ride.amountCents,
    ride.ratingScore,
    ride.ratingComment,
    ride.version,
    activeDriverId(ride),
    ride.createdAt,
    ride.updatedAt,
  ];
}

function activeDriverId(ride: Ride): string | null {
  if ((ride.status === 'ACCEPTED' || ride.status === 'IN_PROGRESS') && ride.driverId) {
    return ride.driverId;
  }
  return null;
}

function toRide(row: RideRow): Ride {
  return {
    id: row.id,
    passengerId: row.passenger_id,
    passengerName: row.passenger_name,
    driverId: row.driver_id,
    driverName: row.driver_name,
    vehicleModel: row.vehicle_model,
    vehiclePlate: row.vehicle_plate,
    driverRating: row.driver_rating,
    status: row.status,
    pickup: row.pickup,
    destination: row.destination,
    distanceKm: row.distance_km,
    durationMin: row.duration_min,
    fareFlag: row.fare_flag,
    discountPercent: row.discount_percent,
    paymentMethod: row.payment_method,
    baseCents: row.base_cents,
    amountCents: row.amount_cents,
    ratingScore: row.rating_score,
    ratingComment: row.rating_comment,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
