export function writeLog(level: 'info' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: 'api',
      message,
      ...fields,
    }) + '\n',
  );
}
