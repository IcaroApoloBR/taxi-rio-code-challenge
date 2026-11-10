import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';

function loadEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '../../.env'),
    join(__dirname, '../../../.env'),
    join(__dirname, '../../../../.env'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const separator = trimmed.indexOf('=');
      if (separator <= 0) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      if (process.env[key] === undefined) {
        process.env[key] = trimmed.slice(separator + 1).trim();
      }
    }
    return;
  }
}

async function bootstrap(): Promise<void> {
  loadEnv();
  const { startTracing } = await import('./http/tracing');
  startTracing('api');
  const { AppModule } = await import('./app.module');
  const { configureApp } = await import('./app.setup');
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
