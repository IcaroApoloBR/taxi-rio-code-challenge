import { Controller, Get, Header } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics({ register, prefix: 'corridas_api_' });

@Controller()
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', register.contentType)
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
