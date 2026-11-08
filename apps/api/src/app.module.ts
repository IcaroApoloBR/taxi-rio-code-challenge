import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';
import { MetricsController } from './metrics.controller';
import { RidesModule } from './rides/rides.module';

@Module({
  imports: [AuthModule, RidesModule],
  controllers: [HealthController, MetricsController],
})
export class AppModule {}
