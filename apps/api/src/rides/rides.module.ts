import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemoryIdempotencyRepository, MemoryOutboxRepository, MemoryRideRepository, MemoryRideUnitOfWork } from './memory-ride.repository';
import { MysqlDatabase } from './mysql-database';
import { MysqlOutboxRepository } from './mysql-outbox.repository';
import { MysqlIdempotencyRepository, MysqlRideRepository, MysqlRideUnitOfWork } from './mysql-ride.repository';
import { OutboxPublisher } from './outbox-publisher';
import { IdempotencyRepository, OutboxRepository, RideRepository, RideUnitOfWork } from './ride.repository';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { MemoryRideStatusCache, RedisRideStatusCache, RideStatusCache } from './status-cache';

const mysql = Boolean(process.env.MYSQL_HOST);
const rabbit = Boolean(process.env.RABBITMQ_URL);
const redis = Boolean(process.env.REDIS_HOST);

const persistence = mysql
  ? [
      MysqlDatabase,
      MysqlRideRepository,
      MysqlIdempotencyRepository,
      MysqlRideUnitOfWork,
      MysqlOutboxRepository,
      { provide: RideRepository, useExisting: MysqlRideRepository },
      { provide: IdempotencyRepository, useExisting: MysqlIdempotencyRepository },
      { provide: RideUnitOfWork, useExisting: MysqlRideUnitOfWork },
      { provide: OutboxRepository, useExisting: MysqlOutboxRepository },
    ]
  : [
      MemoryRideRepository,
      MemoryIdempotencyRepository,
      MemoryRideUnitOfWork,
      MemoryOutboxRepository,
      { provide: RideRepository, useExisting: MemoryRideRepository },
      { provide: IdempotencyRepository, useExisting: MemoryIdempotencyRepository },
      { provide: RideUnitOfWork, useExisting: MemoryRideUnitOfWork },
      { provide: OutboxRepository, useExisting: MemoryOutboxRepository },
    ];

const cache = redis
  ? [RedisRideStatusCache, { provide: RideStatusCache, useExisting: RedisRideStatusCache }]
  : [MemoryRideStatusCache, { provide: RideStatusCache, useExisting: MemoryRideStatusCache }];

const publishing = mysql && rabbit ? [OutboxPublisher] : [];

@Module({
  imports: [AuthModule],
  controllers: [RidesController],
  providers: [RidesService, ...persistence, ...cache, ...publishing],
})
export class RidesModule {}
