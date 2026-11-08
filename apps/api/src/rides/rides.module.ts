import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MemoryIdempotencyRepository, MemoryRideRepository } from './memory-ride.repository';
import { IdempotencyRepository, RideRepository } from './ride.repository';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [AuthModule],
  controllers: [RidesController],
  providers: [
    RidesService,
    MemoryRideRepository,
    MemoryIdempotencyRepository,
    { provide: RideRepository, useExisting: MemoryRideRepository },
    { provide: IdempotencyRepository, useExisting: MemoryIdempotencyRepository },
  ],
})
export class RidesModule {}
